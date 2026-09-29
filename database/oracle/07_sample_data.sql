SET SERVEROUTPUT ON;

INSERT INTO app_users VALUES (1, 'kasun@gmail.com', 'HASH_PASS_101', 'PASSENGER');
INSERT INTO app_users VALUES (2, 'nadeesha@gmail.com', 'HASH_PASS_102', 'PASSENGER');
INSERT INTO app_users VALUES (3, 'admin@smartmove.lk', 'HASH_ADMIN_999', 'ADMIN');

INSERT INTO passengers VALUES (1, 1, 'Kasun Perera', '0771234567');
INSERT INTO passengers VALUES (2, 2, 'Nadeesha Silva', '0719876543');

INSERT INTO drivers VALUES (1, 'Sunil Shantha', '0761122334', 'B-8492011');
INSERT INTO drivers VALUES (2, 'Kamal Gunaratne', '0785566778', 'B-9021884');

INSERT INTO vehicles VALUES (1, 'WP-ND-5421', 'BUS', 32, 'ACTIVE');
INSERT INTO vehicles VALUES (2, 'WP-CAB-8812', 'VAN', 14, 'ACTIVE');
INSERT INTO vehicles VALUES (3, 'SP-NA-3109', 'BUS', 28, 'MAINTENANCE');

INSERT INTO routes VALUES (1, 'Colombo - Kandy', 'Colombo', 'Kandy', 550.00);
INSERT INTO routes VALUES (2, 'Colombo - Galle', 'Colombo', 'Galle', 850.00);

INSERT INTO trips VALUES (1, 1, 1, 1, SYSDATE - 2, SYSDATE - 2 + 3/24, 550.00, 'COMPLETED');
INSERT INTO bookings VALUES (1, 1, 1, SYSDATE - 3, 'CONFIRMED');
INSERT INTO tickets VALUES (1, 1, 1, 550.00, 'ISSUED');
INSERT INTO payments VALUES (1, 1, 'CASH', 550.00, SYSDATE - 3);
INSERT INTO feedback_records VALUES (1, 1, 'REVIEW', 'OPEN');

BEGIN
    schedule_trip(2, 2, 2, 2, SYSDATE + 5, SYSDATE + 5 + 2/24);

    create_booking(2, 2, 2);
    reserve_seat(2, 2, 1);
    reserve_seat(3, 2, 2);
    record_payment(2, 2, 1700.00, 'CASH');

    create_booking(3, 1, 2);
    reserve_seat(4, 3, 3);
    record_payment(3, 3, 850.00, 'CARD');
    cancel_booking(3);
    process_refund(1, 3, 'Personal emergency cancellation');
END;
/

INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date, status)
VALUES (1, 3, 'Brake pad replacement and inspection', SYSDATE - 1, 'SCHEDULED');

INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date, status)
VALUES (2, 1, 'Regular engine oil and filter change', SYSDATE + 10, 'SCHEDULED');

COMMIT;
