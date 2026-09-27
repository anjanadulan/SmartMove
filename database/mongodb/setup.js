use smartmove;

db.feedback_content.insertMany([
    {
        feedbackId: "1",
        routeId: "1",
        vehicleId: "1",
        driverId: "1",
        passengerName: "Kasun Perera",
        vehicleRating: 4,
        driverRating: 5,
        comment: "The bus was clean and comfortable. Driver Sunil was very polite.",
        keywords: ["clean", "comfortable", "polite"],
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
        createdAt: new Date()
    }
]);

db.vehicle_assets.insertMany([
    {
        vehicleId: "1",
        registrationNumber: "WP-ND-5421",
        documentType: "FITNESS_CERTIFICATE",
        fileName: "fitness_cert_nd5421.pdf",
        validUntil: new Date("2027-06-30")
    },
    {
        vehicleId: "1",
        registrationNumber: "WP-ND-5421",
        documentType: "PHOTO",
        fileName: "bus_front_nd5421.jpg"
    },
    {
        vehicleId: "2",
        registrationNumber: "WP-CAB-8812",
        documentType: "INSURANCE",
        fileName: "insurance_cab8812.pdf",
        validUntil: new Date("2027-12-31")
    }
]);

db.announcements.insertMany([
    {
        title: "Southern Expressway Schedule Update",
        content: "Expressway services between Colombo and Galle will run every 30 minutes during holidays.",
        category: "SCHEDULE",
        active: true,
        postedDate: new Date()
    },
    {
        title: "Passenger Luggage Guidelines",
        content: "Please ensure baggage is tagged properly before boarding.",
        category: "NOTICE",
        active: true,
        postedDate: new Date()
    }
]);

db.notifications.insertMany([
    {
        userId: "2",
        bookingId: "2",
        message: "Your booking for Colombo - Galle trip has been confirmed.",
        isRead: false,
        sentAt: new Date()
    }
]);

db.trip_media.insertMany([
    {
        tripId: "1",
        routeId: "1",
        mediaType: "IMAGE",
        url: "/media/trips/colombo_kandy_scenic.jpg",
        caption: "Scenic Kadugannawa pass on Colombo - Kandy route"
    }
]);
