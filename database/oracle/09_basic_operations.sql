SET SERVEROUTPUT ON;

BEGIN
    add_vehicle(90, 'WP-ND-9999', 'VAN', 10);
    update_vehicle(90, 'WP-ND-9999', 'VAN', 12, 'ACTIVE');
    add_driver(90, 'Test Driver', '0770000090', 'B-1112223');
    update_driver(90, 'Test Driver Updated', '0770000091', 'B-1112223');
    add_route(90, 'Kandy - Matale', 'Kandy', 'Matale', 300.00);
    update_route(90, 'Kandy - Matale Express', 350.00);
END;
/

SELECT * FROM vehicles WHERE vehicle_id = 90;
SELECT * FROM drivers WHERE driver_id = 90;
SELECT * FROM routes WHERE route_id = 90;

BEGIN
    delete_vehicle(90);
    delete_driver(90);
    delete_route(90);
END;
/

BEGIN
    add_app_user(90, 'testuser@gmail.com', 'HASH_PRACTICE_90', 'PASSENGER');
    add_passenger(90, 90, 'Test Passenger', '0710000090');
    update_app_user(90, 'testuser90@gmail.com', 'PASSENGER');
    change_password_hash(90, 'HASH_PRACTICE_90_NEW');
    update_passenger(90, 'Test Passenger Updated', '0710000091');
END;
/

SELECT * FROM user_details WHERE user_id = 90;
SELECT * FROM passengers WHERE passenger_id = 90;

BEGIN
    delete_passenger(90);
    delete_app_user(90);
END;
/

BEGIN
    schedule_maintenance(90, 3, 'Brake test inspection', SYSDATE);
    update_maintenance(90, 'Emergency brake repair', SYSDATE);
    complete_maintenance(90, 2500.00);
    schedule_maintenance(91, 3, 'Suspension check', SYSDATE + 5);
    delete_maintenance(91);
END;
/

SELECT * FROM maintenance_records WHERE maintenance_id = 90;

BEGIN
    add_feedback(90, 1, 'REVIEW');
    update_feedback_status(90, 'RESOLVED');
END;
/

SELECT * FROM feedback_records WHERE feedback_id = 90;

ROLLBACK;
