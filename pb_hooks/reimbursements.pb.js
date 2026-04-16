/// <reference path="../pb_data/types.d.ts" />

// GET /api/my-reimbursements
routerAdd("GET", "/api/my-reimbursements", function(e) {
  var info = e.requestInfo();
  var user = info.auth;
  if (!user) {
    return e.json(401, { error: "Not authenticated" });
  }

  var records = $app.findRecordsByFilter(
    "reimbursements",
    "user = {:userId}",
    "-id",
    50,
    0,
    { userId: user.id }
  );

  var items = [];
  if (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      items.push({
        id: r.id,
        submitted_by: r.get("submitted_by"),
        photo_url: r.get("photo_url"),
        provider: r.get("provider"),
        ride_date: r.get("ride_date"),
        total_amount: r.get("total_amount"),
        currency: r.get("currency"),
        pickup: r.get("pickup"),
        drop_location: r.get("drop_location"),
        status: r.get("status")
      });
    }
  }
  return e.json(200, { items: items });
});

// GET /api/all-reimbursements
routerAdd("GET", "/api/all-reimbursements", function(e) {
  var info = e.requestInfo();
  if (!info.auth) {
    return e.json(401, { error: "Not authenticated" });
  }

  var records = $app.findRecordsByFilter(
    "reimbursements",
    "1=1",
    "-id",
    200,
    0
  );

  var items = [];
  if (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      items.push({
        id: r.id,
        submitted_by: r.get("submitted_by"),
        photo_url: r.get("photo_url"),
        provider: r.get("provider"),
        ride_date: r.get("ride_date"),
        total_amount: r.get("total_amount"),
        currency: r.get("currency"),
        pickup: r.get("pickup"),
        drop_location: r.get("drop_location"),
        status: r.get("status")
      });
    }
  }
  return e.json(200, { items: items });
});

// PATCH /api/reimbursements/:id/status
routerAdd("PATCH", "/api/reimbursements/{id}/status", function(e) {
  var info = e.requestInfo();
  if (!info.auth) {
    return e.json(401, { error: "Not authenticated" });
  }

  var id = e.request.pathValue("id");
  var newStatus = info.body.status;

  if (["pending", "approved", "rejected"].indexOf(newStatus) === -1) {
    return e.json(400, { error: "Invalid status" });
  }

  var record = $app.findRecordById("reimbursements", id);
  record.set("status", newStatus);
  $app.save(record);

  // Sync status change to Google Sheet
  try {
    $http.send({
      url: "https://us-central1-bill-scanner-ebaa8.cloudfunctions.net/pbSheetSync",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "pronto-pb-sync-2026",
        action: "updateStatus",
        id: id,
        status: newStatus
      }),
      timeout: 10
    });
  } catch(err) {
    // Log but don't fail the request
    console.log("Sheet sync error:", err);
  }

  return e.json(200, { ok: true });
});

// Hook: sync new reimbursement to Google Sheet on create
onRecordAfterCreateSuccess(function(e) {
  var r = e.record;
  try {
    $http.send({
      url: "https://us-central1-bill-scanner-ebaa8.cloudfunctions.net/pbSheetSync",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "pronto-pb-sync-2026",
        action: "append",
        data: {
          id:             r.id,
          submitted_by:   r.get("submitted_by"),
          email:          r.get("email"),
          provider:       r.get("provider"),
          ride_id:        r.get("ride_id"),
          ride_date:      r.get("ride_date"),
          pickup:         r.get("pickup"),
          drop_location:  r.get("drop_location"),
          total_amount:   r.get("total_amount"),
          currency:       r.get("currency"),
          payment_method: r.get("payment_method"),
          purpose:        r.get("purpose"),
          status:         r.get("status"),
          created:        r.get("created")
        }
      }),
      timeout: 10
    });
  } catch(err) {
    console.log("Sheet append error:", err);
  }
}, "reimbursements");
