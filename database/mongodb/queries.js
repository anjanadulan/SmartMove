use smartmove;

// 1. Retrieve all feedback reviews for Route 1
db.feedback_content.find({ routeId: "1" });

// 2. Sort all feedback by vehicle rating descending
db.feedback_content.find({}).sort({ vehicleRating: -1 });

// 3. Average rating for each vehicle
db.feedback_content.aggregate([
    { $group: { _id: "$vehicleId", averageRating: { $avg: "$vehicleRating" } } },
    { $sort: { averageRating: -1 } }
]);

// 4. Average rating for each driver
db.feedback_content.aggregate([
    { $group: { _id: "$driverId", averageRating: { $avg: "$driverRating" } } },
    { $sort: { averageRating: -1 } }
]);

// 5. Search feedback matching specific complaint keywords
db.feedback_content.find({ keywords: { $in: ["delay", "traffic"] } });

// 6. Retrieve vehicle documents and assets for Vehicle 1
db.vehicle_assets.find({ vehicleId: "1" });

// 7. Retrieve trip multimedia content for Trip 1
db.trip_media.find({ tripId: "1" });

// 8. Count total reviews and check unread notifications for User 2
db.feedback_content.countDocuments();
db.notifications.find({ userId: "2", isRead: false });
