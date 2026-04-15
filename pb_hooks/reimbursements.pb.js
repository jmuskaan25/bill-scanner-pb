/// <reference path="../pb_data/types.d.ts" />

// Shared helper to serialize a reimbursement record
function serializeRecord(r) {
  return {
    id: r.id,
    submitted_by: r.get("submitted_by"),
    photo_url: r.get("photo_url"),
    email: r.get("email"),
    provider: r.get("provider"),
    ride_id: r.get("ride_id"),
    rider_name: r.get("rider_name"),
    driver_name: r.get("driver_name"),
    vehicle_number: r.get("vehicle_number"),
    pickup: r.get("pickup"),
    drop_location: r.get("drop_location"),
    ride_date: r.get("ride_date"),
    total_amount: r.get("total_amount"),
    currency: r.get("currency"),
    payment_method: r.get("payment_method"),
    purpose: r.get("purpose"),
    status: r.get("status"),
    receipt_image: r.get("receipt_image"),
    user: r.get("user")
  };
}

// GET /api/my-reimbursements - returns current user's reimbursements
routerAdd("GET", "/api/my-reimbursements", (e) => {
  const info = e.requestInfo();
  const userId = info.auth?.id;

  if (!userId) {
    return e.json(401, { error: "Not authenticated" });
  }

  const records = $app.findRecordsByFilter(
    "reimbursements",
    "user = {:userId}",
    "-id",
    50,
    0,
    { userId: userId }
  );

  return e.json(200, { items: (records || []).map(serializeRecord) });
}, $apis.requireAuth());

// GET /api/all-reimbursements - returns all reimbursements (admin only)
routerAdd("GET", "/api/all-reimbursements", (e) => {
  const records = $app.findRecordsByFilter(
    "reimbursements",
    "1=1",
    "-id",
    200,
    0
  );

  return e.json(200, { items: (records || []).map(serializeRecord) });
}, $apis.requireAuth());

// PATCH /api/reimbursements/:id/status - update status (admin only)
routerAdd("PATCH", "/api/reimbursements/{id}/status", (e) => {
  const id = e.request.pathValue("id");
  const body = e.requestInfo().body;
  const newStatus = body.status;

  if (!newStatus || ["pending", "approved", "rejected"].indexOf(newStatus) === -1) {
    return e.json(400, { error: "Invalid status" });
  }

  const record = $app.findRecordById("reimbursements", id);
  record.set("status", newStatus);
  $app.save(record);

  return e.json(200, serializeRecord(record));
}, $apis.requireAuth());
