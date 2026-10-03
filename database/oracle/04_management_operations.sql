SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE add_vehicle (
    p_id IN NUMBER,
    p_registration IN VARCHAR2,
    p_type IN VARCHAR2,
    p_seats IN NUMBER
)
AS
BEGIN
    INSERT INTO vehicles (vehicle_id, registration_number, vehicle_type, seat_count, status)
    VALUES (p_id, p_registration, p_type, p_seats, 'ACTIVE');
END add_vehicle;
/

CREATE OR REPLACE PROCEDURE update_vehicle (
    p_id IN NUMBER,
    p_registration IN VARCHAR2,
    p_type IN VARCHAR2,
    p_seats IN NUMBER,
    p_status IN VARCHAR2
)
AS
    v_trip_count NUMBER;
    ex_invalid_vehicle EXCEPTION;
BEGIN
    SELECT COUNT(*)
    INTO v_trip_count
    FROM trips
    WHERE vehicle_id = p_id
      AND status = 'SCHEDULED';

    IF p_status = 'MAINTENANCE' AND v_trip_count > 0 THEN
        RAISE ex_invalid_vehicle;
    END IF;

    UPDATE vehicles
    SET registration_number = p_registration,
        vehicle_type = p_type,
        seat_count = p_seats,
        status = p_status
    WHERE vehicle_id = p_id;
EXCEPTION
    WHEN ex_invalid_vehicle THEN
        DBMS_OUTPUT.PUT_LINE('Error: Cannot set vehicle to maintenance with active scheduled trips.');
        RAISE;
END update_vehicle;
/

CREATE OR REPLACE PROCEDURE delete_vehicle (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM vehicles WHERE vehicle_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_vehicle;
/

CREATE OR REPLACE PROCEDURE add_driver (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_licence IN VARCHAR2
)
AS
BEGIN
    INSERT INTO drivers (driver_id, full_name, phone, licence_number)
    VALUES (p_id, p_name, p_phone, p_licence);
END add_driver;
/

CREATE OR REPLACE PROCEDURE update_driver (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_licence IN VARCHAR2
)
AS
BEGIN
    UPDATE drivers
    SET full_name = p_name,
        phone = p_phone,
        licence_number = p_licence
    WHERE driver_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_driver;
/

CREATE OR REPLACE PROCEDURE delete_driver (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM drivers WHERE driver_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_driver;
/

CREATE OR REPLACE PROCEDURE add_route (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_origin IN VARCHAR2,
    p_destination IN VARCHAR2,
    p_fare IN NUMBER
)
AS
BEGIN
    INSERT INTO routes (route_id, route_name, origin, destination, base_fare)
    VALUES (p_id, p_name, p_origin, p_destination, p_fare);
END add_route;
/

CREATE OR REPLACE PROCEDURE update_route (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_fare IN NUMBER
)
AS
BEGIN
    UPDATE routes
    SET route_name = p_name,
        base_fare = p_fare
    WHERE route_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_route;
/

CREATE OR REPLACE PROCEDURE delete_route (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM routes WHERE route_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_route;
/

CREATE OR REPLACE PROCEDURE add_app_user (
    p_id IN NUMBER,
    p_email IN VARCHAR2,
    p_hash IN VARCHAR2,
    p_role IN VARCHAR2
)
AS
BEGIN
    INSERT INTO app_users (user_id, email, password_hash, role)
    VALUES (p_id, p_email, p_hash, p_role);
END add_app_user;
/

CREATE OR REPLACE PROCEDURE update_app_user (
    p_id IN NUMBER,
    p_email IN VARCHAR2,
    p_role IN VARCHAR2
)
AS
BEGIN
    UPDATE app_users
    SET email = p_email,
        role = p_role
    WHERE user_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_app_user;
/

CREATE OR REPLACE PROCEDURE change_password_hash (
    p_id IN NUMBER,
    p_hash IN VARCHAR2
)
AS
BEGIN
    UPDATE app_users
    SET password_hash = p_hash
    WHERE user_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END change_password_hash;
/

CREATE OR REPLACE PROCEDURE delete_app_user (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM app_users WHERE user_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_app_user;
/

CREATE OR REPLACE PROCEDURE add_passenger (
    p_id IN NUMBER,
    p_user_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
)
AS
BEGIN
    INSERT INTO passengers (passenger_id, user_id, full_name, phone)
    VALUES (p_id, p_user_id, p_name, p_phone);
END add_passenger;
/

CREATE OR REPLACE PROCEDURE update_passenger (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
)
AS
BEGIN
    UPDATE passengers
    SET full_name = p_name,
        phone = p_phone
    WHERE passenger_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_passenger;
/

CREATE OR REPLACE PROCEDURE delete_passenger (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM passengers WHERE passenger_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_passenger;
/

CREATE OR REPLACE PROCEDURE schedule_maintenance (
    p_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_type IN VARCHAR2,
    p_scheduled_date IN DATE
)
AS
BEGIN
    INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date, status)
    VALUES (p_id, p_vehicle_id, p_type, p_scheduled_date, 'SCHEDULED');
END schedule_maintenance;
/

CREATE OR REPLACE PROCEDURE update_maintenance (
    p_id IN NUMBER,
    p_type IN VARCHAR2,
    p_scheduled_date IN DATE
)
AS
BEGIN
    UPDATE maintenance_records
    SET maintenance_type = p_type,
        scheduled_date = p_scheduled_date
    WHERE maintenance_id = p_id
      AND status = 'SCHEDULED';

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_maintenance;
/

CREATE OR REPLACE PROCEDURE delete_maintenance (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM maintenance_records
    WHERE maintenance_id = p_id
      AND status = 'SCHEDULED';

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_maintenance;
/

CREATE OR REPLACE PROCEDURE add_feedback (
    p_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_type IN VARCHAR2
)
AS
BEGIN
    INSERT INTO feedback_records (feedback_id, booking_id, feedback_type, status)
    VALUES (p_id, p_booking_id, p_type, 'OPEN');
END add_feedback;
/

CREATE OR REPLACE PROCEDURE update_feedback_status (
    p_id IN NUMBER,
    p_status IN VARCHAR2
)
AS
BEGIN
    UPDATE feedback_records
    SET status = p_status
    WHERE feedback_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_feedback_status;
/
