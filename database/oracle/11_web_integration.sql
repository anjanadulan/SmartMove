-- One-time migration for the live SmartMove website. Run in XEPDB1 as SYSDBA.
-- Do not rerun 01_users.sql, 02_schema.sql, or 05_sample_data.sql.
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = XEPDB1;

CREATE SEQUENCE smartmove_database.web_user_seq START WITH 100000 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE smartmove_database.web_passenger_seq START WITH 100000 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE smartmove_database.web_booking_seq START WITH 100000 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE smartmove_database.web_ticket_seq START WITH 100000 INCREMENT BY 1 NOCACHE;

CREATE TABLE smartmove_database.web_sessions (
    session_hash VARCHAR2(64) PRIMARY KEY,
    passenger_id NUMBER NOT NULL REFERENCES smartmove_database.passengers(passenger_id),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX smartmove_database.web_sessions_expiry_idx
    ON smartmove_database.web_sessions(expires_at);

-- The scheduled job updates expired holds even when no one visits the website.
CREATE OR REPLACE PROCEDURE smartmove_database.expire_pending_bookings AS
BEGIN
    UPDATE smartmove_database.bookings
    SET status = 'CANCELLED'
    WHERE status = 'PENDING'
      AND booked_at <= SYSDATE - (30 / 1440);

    UPDATE smartmove_database.tickets t
    SET status = 'CANCELLED'
    WHERE status = 'RESERVED'
      AND EXISTS (
          SELECT 1
          FROM smartmove_database.bookings b
          WHERE b.booking_id = t.booking_id
            AND b.status = 'CANCELLED'
      );
END;
/

-- Lock the trip for the whole transaction; callers commit or roll back.
CREATE OR REPLACE PROCEDURE smartmove_database.create_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_trip_id IN NUMBER
) AS
    v_status smartmove_database.trips.status%TYPE;
    v_departure smartmove_database.trips.departure_at%TYPE;
BEGIN
    SELECT status, departure_at
    INTO v_status, v_departure
    FROM smartmove_database.trips
    WHERE trip_id = p_trip_id
    FOR UPDATE;
    IF v_status <> 'SCHEDULED' OR v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20001, 'Trip is unavailable.');
    END IF;
    INSERT INTO smartmove_database.bookings (booking_id, passenger_id, trip_id)
    VALUES (p_booking_id, p_passenger_id, p_trip_id);
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.reserve_seat (
    p_ticket_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_seat_number IN NUMBER
) AS
    v_trip_id NUMBER;
    v_booking_status VARCHAR2(12);
    v_booked_at DATE;
    v_trip_status VARCHAR2(12);
    v_departure DATE;
    v_fare NUMBER;
    v_seat_count NUMBER;
    v_taken NUMBER;
BEGIN
    SELECT trip_id, status, booked_at
    INTO v_trip_id, v_booking_status, v_booked_at
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id;

    SELECT t.status, t.departure_at, t.fare, v.seat_count
    INTO v_trip_status, v_departure, v_fare, v_seat_count
    FROM smartmove_database.trips t
    JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = v_trip_id FOR UPDATE OF t.status;

    IF p_seat_number IS NULL OR p_seat_number <> TRUNC(p_seat_number)
       OR p_seat_number < 1 OR p_seat_number > v_seat_count
       OR v_booking_status <> 'PENDING'
       OR v_booked_at <= SYSDATE - (30 / 1440)
       OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20002, 'Seat or booking is unavailable.');
    END IF;

    SELECT COUNT(*)
    INTO v_taken
    FROM smartmove_database.tickets t
    JOIN smartmove_database.bookings b ON b.booking_id = t.booking_id
    WHERE b.trip_id = v_trip_id
      AND t.seat_number = p_seat_number
      AND (t.status = 'ISSUED' OR
           (t.status = 'RESERVED' AND b.status = 'PENDING'
            AND b.booked_at > SYSDATE - (30 / 1440)));
    IF v_taken > 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Seat is already reserved.');
    END IF;

    INSERT INTO smartmove_database.tickets (ticket_id, booking_id, seat_number, fare_amount)
    VALUES (p_ticket_id, p_booking_id, p_seat_number, v_fare);
END;
/

CREATE OR REPLACE FUNCTION smartmove_database.available_seats (p_trip_id IN NUMBER)
RETURN NUMBER AS
    v_total NUMBER;
    v_taken NUMBER;
BEGIN
    SELECT v.seat_count
    INTO v_total
    FROM smartmove_database.trips t
    JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = p_trip_id;
    SELECT COUNT(*)
    INTO v_taken
    FROM smartmove_database.tickets t
    JOIN smartmove_database.bookings b ON b.booking_id = t.booking_id
    WHERE b.trip_id = p_trip_id
      AND (t.status = 'ISSUED' OR
           (t.status = 'RESERVED' AND b.status = 'PENDING'
            AND b.booked_at > SYSDATE - (30 / 1440)));
    RETURN v_total - v_taken;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;
/

-- Payment remains a staff operation; expired holds cannot become tickets.
CREATE OR REPLACE PROCEDURE smartmove_database.record_payment (
    p_payment_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_amount IN NUMBER,
    p_method IN VARCHAR2
) AS
    v_status VARCHAR2(12);
    v_booked_at DATE;
    v_trip_status VARCHAR2(12);
    v_departure DATE;
    v_total NUMBER;
BEGIN
    SELECT b.status, b.booked_at, t.status, t.departure_at
    INTO v_status, v_booked_at, v_trip_status, v_departure
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id
    FOR UPDATE OF b.status;

    SELECT SUM(fare_amount)
    INTO v_total
    FROM smartmove_database.tickets
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';
    IF v_status <> 'PENDING' OR v_booked_at <= SYSDATE - (30 / 1440)
       OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE
       OR v_total IS NULL
       OR p_amount IS NULL
       OR p_amount <> v_total THEN
        RAISE_APPLICATION_ERROR(-20004, 'Booking or payment is invalid or expired.');
    END IF;
    INSERT INTO smartmove_database.payments (payment_id, booking_id, amount, payment_method)
    VALUES (p_payment_id, p_booking_id, p_amount, p_method);
    UPDATE smartmove_database.tickets
    SET status = 'ISSUED'
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    UPDATE smartmove_database.bookings
    SET status = 'CONFIRMED'
    WHERE booking_id = p_booking_id;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_register_passenger (
    p_email IN VARCHAR2,
    p_password_hash IN VARCHAR2,
    p_full_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_user_id OUT NUMBER,
    p_passenger_id OUT NUMBER
) AS
BEGIN
    p_user_id := smartmove_database.web_user_seq.NEXTVAL;
    p_passenger_id := smartmove_database.web_passenger_seq.NEXTVAL;
    INSERT INTO smartmove_database.app_users (user_id, email, password_hash, role)
    VALUES (p_user_id, LOWER(TRIM(p_email)), p_password_hash, 'PASSENGER');
    INSERT INTO smartmove_database.passengers (passenger_id, user_id, full_name, phone)
    VALUES (p_passenger_id, p_user_id, TRIM(p_full_name), TRIM(p_phone));
END;
/

CREATE OR REPLACE VIEW smartmove_database.web_passenger_login AS
SELECT u.email, u.password_hash, p.passenger_id, p.full_name
FROM smartmove_database.app_users u
JOIN smartmove_database.passengers p ON p.user_id = u.user_id
WHERE u.role = 'PASSENGER';

CREATE OR REPLACE VIEW smartmove_database.web_trip_search AS
SELECT t.trip_id, r.route_name, r.origin, r.destination,
       t.departure_at, t.arrival_at, t.fare,
       v.vehicle_type, v.registration_number, v.seat_count,
       smartmove_database.available_seats(t.trip_id) available_seats
FROM smartmove_database.trips t
JOIN smartmove_database.routes r ON r.route_id = t.route_id
JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
WHERE t.status = 'SCHEDULED' AND t.departure_at > SYSDATE;

-- A dedicated user is created separately with a random local password.
-- Run these grants only after SMARTMOVE_DATABASE_APP exists.
GRANT CREATE SESSION TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_trip_search TO smartmove_database_app;
GRANT SELECT ON smartmove_database.trips TO smartmove_database_app;
GRANT SELECT ON smartmove_database.routes TO smartmove_database_app;
GRANT SELECT ON smartmove_database.vehicles TO smartmove_database_app;
GRANT SELECT ON smartmove_database.bookings TO smartmove_database_app;
GRANT SELECT ON smartmove_database.tickets TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_passenger_login TO smartmove_database_app;
GRANT SELECT, INSERT, DELETE ON smartmove_database.web_sessions TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_register_passenger TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.create_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.reserve_seat TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_booking_seq TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_ticket_seq TO smartmove_database_app;

BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name => 'SMARTMOVE_DATABASE.EXPIRE_BOOKING_HOLDS',
        job_type => 'STORED_PROCEDURE',
        job_action => 'SMARTMOVE_DATABASE.EXPIRE_PENDING_BOOKINGS',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY;INTERVAL=1',
        enabled => TRUE
    );
END;
/

COMMIT;
