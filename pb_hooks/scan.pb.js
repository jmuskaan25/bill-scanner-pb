/// <reference path="../pb_data/types.d.ts" />

// POST /api/scan - proxies bill image to Claude API server-side
routerAdd("POST", "/api/scan", (e) => {
  const body = e.requestInfo().body;
  const base64Data = body.image;      // base64 string
  const mediaType = body.media_type;  // e.g. "image/jpeg" or "application/pdf"

  if (!base64Data || !mediaType) {
    return e.json(400, { error: "Missing image or media_type" });
  }

  const apiKey = $os.getenv("CLAUDE_API_KEY");
  if (!apiKey) {
    return e.json(500, { error: "CLAUDE_API_KEY not configured on server" });
  }

  // Build the content block based on media type
  let fileBlock;
  if (mediaType === "application/pdf") {
    fileBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Data
      }
    };
  } else {
    fileBlock = {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data
      }
    };
  }

  const res = $http.send({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: 'Extract the following fields from this cab/ride receipt image and return ONLY a JSON object (no markdown, no code fences):\n{\n  "provider": "Uber/Ola/Rapido/Auto/Other",\n  "rideId": "booking or trip ID",\n  "riderName": "passenger name",\n  "driverName": "driver name",\n  "vehicleNumber": "vehicle registration number",\n  "pickup": "pickup address",\n  "drop": "drop/destination address",\n  "date": "YYYY-MM-DD",\n  "totalAmount": 123.45,\n  "currency": "INR/USD/EUR/GBP",\n  "paymentMethod": "cash/upi/card"\n}\nIf a field is not found, use null. For totalAmount, use a number (not string). For date, use YYYY-MM-DD format.'
          }
        ]
      }]
    })
  });

  if (res.statusCode !== 200) {
    return e.json(res.statusCode, { error: "Claude API error", details: res.raw });
  }

  const result = JSON.parse(res.raw);
  return e.json(200, result);
}, $apis.requireAuth());
