use smartmove;

// Reset collections
db.feedback_content.deleteMany({});
db.vehicle_assets.deleteMany({});
db.announcements.deleteMany({});
db.notifications.deleteMany({});
db.trip_media.deleteMany({});

// Feedback reviews and passenger comments
db.feedback_content.insertMany([
  {
    feedbackId: "1",
    routeId: "1",
    vehicleId: "1",
    driverId: "1",
    passengerName: "Kasun Perera",
    vehicleRating: 4,
    driverRating: 5,
    comment: "The vehicle was clean and comfortable. Driver Sunil was very polite.",
    keywords: ["clean", "comfortable", "polite"],
    published: true,
    reply: {
      staffName: "Operations Staff",
      message: "Thank you for your feedback."
    },
    createdAt: new Date()
  },
  {
    feedbackId: "2",
    routeId: "2",
    vehicleId: "2",
    driverId: "2",
    passengerName: "Nadeesha Silva",
    vehicleRating: 3,
    driverRating: 4,
    comment: "Departure was slightly delayed due to expressway traffic, but smooth ride.",
    keywords: ["delay", "traffic", "smooth"],
    published: true,
    createdAt: new Date()
  }
]);

// Vehicle asset records and documentation
db.vehicle_assets.insertMany([
  {
    vehicleId: "1",
    assetType: "IMAGE",
    fileUrl: "/uploads/demo-vehicle.png",
    registrationNumber: "WP-ND-5421",
    documentType: "PHOTO"
  },
  {
    vehicleId: "1",
    assetType: "DOCUMENT",
    fileUrl: "/uploads/demo-vehicle-record.pdf",
    registrationNumber: "WP-ND-5421",
    documentType: "FITNESS_CERTIFICATE",
    validUntil: new Date("2027-06-30")
  },
  {
    vehicleId: "2",
    assetType: "DOCUMENT",
    fileUrl: "/uploads/demo-vehicle-record.pdf",
    registrationNumber: "WP-CAB-8812",
    documentType: "INSURANCE",
    validUntil: new Date("2027-12-31")
  }
]);

// Operational announcements
db.announcements.insertMany([
  {
    title: "Southern Expressway Schedule Update",
    body: "Expressway services between Colombo and Galle will run every 30 minutes during holidays.",
    content: "Expressway services between Colombo and Galle will run every 30 minutes during holidays.",
    audience: "ALL",
    category: "SCHEDULE",
    active: true,
    createdAt: new Date(),
    postedDate: new Date()
  },
  {
    title: "Passenger Luggage Guidelines",
    body: "Please ensure baggage is tagged properly before boarding.",
    content: "Please ensure baggage is tagged properly before boarding.",
    audience: "PASSENGERS",
    category: "NOTICE",
    active: true,
    createdAt: new Date(),
    postedDate: new Date()
  },
  {
    title: "Arrive early",
    body: "Please arrive 15 minutes before departure.",
    content: "Please arrive 15 minutes before departure.",
    audience: "PASSENGERS",
    category: "NOTICE",
    active: true,
    createdAt: new Date(),
    postedDate: new Date()
  }
]);

// System notifications
db.notifications.insertMany([
  {
    userId: "2",
    bookingId: "2",
    message: "Your booking for Colombo - Galle trip has been confirmed.",
    isRead: false,
    sentAt: new Date(),
    createdAt: new Date()
  }
]);

// Trip multimedia
db.trip_media.insertMany([
  {
    tripId: "1",
    routeId: "1",
    uploadedBy: "1",
    mediaType: "IMAGE",
    fileUrl: "/uploads/demo-trip.png",
    url: "/uploads/demo-trip.png",
    caption: "Scenic Kadugannawa pass on Colombo - Kandy route"
  }
]);
