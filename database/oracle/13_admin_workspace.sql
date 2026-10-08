-- One-time migration after 09_web_integration.sql and 10_passenger_portal.sql.
-- Run in XEPDB1 as SYSDBA. Do not rerun base schema or sample data.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

CREATE TABLE smartmove_database.web_admin_sessions (
    session_hash VARCHAR2(64) PRIMARY KEY,
    user_id NUMBER NOT NULL REFERENCES smartmove_database.app_users(user_id),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX smartmove_database.web_admin_sessions_expiry_idx
    ON smartmove_database.web_admin_sessions(expires_at);

CREATE OR REPLACE VIEW smartmove_database.web_admin_login AS
SELECT user_id, email, password_hash
FROM smartmove_database.app_users
WHERE role = 'ADMIN';

CREATE SEQUENCE smartmove_database.web_route_seq START WITH 100000 NOCACHE;
CREATE SEQUENCE smartmove_database.web_trip_seq START WITH 100000 NOCACHE;
CREATE SEQUENCE smartmove_database.web_vehicle_seq START WITH 100000 NOCACHE;
CREATE SEQUENCE smartmove_database.web_driver_seq START WITH 100000 NOCACHE;
CREATE SEQUENCE smartmove_database.web_maintenance_seq START WITH 100000 NOCACHE;
CREATE SEQUENCE smartmove_database.web_payment_seq START WITH 100000 NOCACHE;

-- Reuse the booking lock in record_payment and web_cancel_booking.
CREATE OR REPLACE PROCEDURE smartmove_database.web_admin_record_payment (
    p_booking_id IN NUMBER,
    p_method IN VARCHAR2,
    p_payment_id OUT NUMBER,
    p_amount OUT NUMBER
) AS
BEGIN
    SELECT SUM(fare_amount)
    INTO p_amount
    FROM smartmove_database.tickets
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    IF p_amount IS NULL THEN
        RAISE_APPLICATION_ERROR(-20101, 'No reserved seats to pay for.');
    END IF;

    p_payment_id := smartmove_database.web_payment_seq.NEXTVAL;
    smartmove_database.record_payment(
        p_payment_id,
        p_booking_id,
        p_amount,
        p_method
    );
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_admin_cancel_booking (
    p_booking_id IN NUMBER,
    p_changed OUT NUMBER,
    p_refund_amount OUT NUMBER
) AS
    v_passenger_id NUMBER;
BEGIN
    SELECT passenger_id
    INTO v_passenger_id
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id;

    smartmove_database.web_cancel_booking(
        p_booking_id,
        v_passenger_id,
        p_changed,
        p_refund_amount
    );
END;
/

-- Trip row lock serializes new bookings and trip cancellation. Booking locks
-- serialize payment and individual cancellation. Any error rolls all back.
CREATE OR REPLACE PROCEDURE smartmove_database.web_admin_cancel_trip (
    p_trip_id IN NUMBER,
    p_changed OUT NUMBER,
    p_refund_count OUT NUMBER
) AS
    v_status VARCHAR2(12);
    v_departure DATE;
    v_changed NUMBER;
    v_amount NUMBER;
BEGIN
    p_changed := 0;
    p_refund_count := 0;

    SELECT status, departure_at
    INTO v_status, v_departure
    FROM smartmove_database.trips
    WHERE trip_id = p_trip_id
    FOR UPDATE;

    IF v_status = 'CANCELLED' THEN
        RETURN;
    END IF;

    IF v_status <> 'SCHEDULED' OR v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20102, 'Only future scheduled trips can be cancelled.');
    END IF;

    FOR b IN (
        SELECT booking_id, passenger_id
        FROM smartmove_database.bookings
        WHERE trip_id = p_trip_id
          AND status <> 'CANCELLED'
        ORDER BY booking_id
    ) LOOP
        smartmove_database.web_cancel_booking(
            b.booking_id,
            b.passenger_id,
            v_changed,
            v_amount
        );

        IF v_amount > 0 THEN
            p_refund_count := p_refund_count + 1;
        END IF;
    END LOOP;

    UPDATE smartmove_database.trips
    SET status = 'CANCELLED'
    WHERE trip_id = p_trip_id;

    p_changed := 1;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_admin_record_refund (
    p_booking_id IN NUMBER,
    p_changed OUT NUMBER,
    p_amount OUT NUMBER
) AS
    v_status VARCHAR2(12);
    v_payment_id NUMBER;
    v_refund_count NUMBER;
BEGIN
    p_changed := 0;

    SELECT status
    INTO v_status
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF v_status <> 'CANCELLED' THEN
        RAISE_APPLICATION_ERROR(-20103, 'Booking is not cancelled.');
    END IF;

    SELECT payment_id, amount
    INTO v_payment_id, p_amount
    FROM smartmove_database.payments
    WHERE booking_id = p_booking_id;

    SELECT COUNT(*)
    INTO v_refund_count
    FROM smartmove_database.refunds
    WHERE payment_id = v_payment_id;

    IF v_refund_count > 0 THEN
        RETURN;
    END IF;

    smartmove_database.process_refund(
        smartmove_database.web_refund_seq.NEXTVAL,
        v_payment_id,
        'Admin recorded eligible full refund'
    );

    p_changed := 1;
END;
/

-- These administration operation definitions have not previously been compiled in
-- the populated local schema. They create procedures only; no sample inserts.
ALTER SESSION SET CURRENT_SCHEMA = SMARTMOVE_DATABASE;
@@03_management_operations.sql
@@03_trip_operations.sql
ALTER SESSION SET CURRENT_SCHEMA = SYS;

GRANT SELECT ON smartmove_database.web_admin_login TO smartmove_database_app;
GRANT SELECT, INSERT, DELETE ON smartmove_database.web_admin_sessions TO smartmove_database_app;
GRANT SELECT ON smartmove_database.app_users TO smartmove_database_app;
GRANT SELECT ON smartmove_database.passengers TO smartmove_database_app;
GRANT SELECT ON smartmove_database.drivers TO smartmove_database_app;
GRANT SELECT ON smartmove_database.maintenance_records TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_route_seq TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_trip_seq TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_vehicle_seq TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_driver_seq TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_maintenance_seq TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_admin_record_payment TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_admin_cancel_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_admin_cancel_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_admin_record_refund TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.schedule_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.reschedule_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.complete_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_passenger TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.schedule_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.complete_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_maintenance TO smartmove_database_app;

COMMIT;
