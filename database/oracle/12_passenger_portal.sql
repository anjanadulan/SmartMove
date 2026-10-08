-- One-time passenger portal migration. Run as SYSDBA in XEPDB1 after 09_web_integration.sql.
-- Existing setup and sample-data scripts must not be rerun.
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = XEPDB1;

CREATE SEQUENCE smartmove_database.web_refund_seq START WITH 100000 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE smartmove_database.web_feedback_seq START WITH 100000 INCREMENT BY 1 NOCACHE;

CREATE UNIQUE INDEX smartmove_database.web_one_review_per_booking
    ON smartmove_database.feedback_records
    (CASE WHEN feedback_type = 'REVIEW' THEN booking_id END);

CREATE TABLE smartmove_database.web_notification_baseline (
    baseline_id NUMBER PRIMARY KEY CHECK (baseline_id = 1),
    started_at DATE NOT NULL
);
INSERT INTO smartmove_database.web_notification_baseline VALUES (1, SYSDATE);

CREATE OR REPLACE VIEW smartmove_database.web_passenger_login AS
SELECT u.user_id, u.email, u.password_hash,
       p.passenger_id, p.full_name, p.phone
FROM smartmove_database.app_users u
JOIN smartmove_database.passengers p ON p.user_id = u.user_id
WHERE u.role = 'PASSENGER';

-- The booking lock serializes this operation with record_payment.
-- An already cancelled booking returns its existing refund without a second write.
CREATE OR REPLACE PROCEDURE smartmove_database.web_cancel_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_changed OUT NUMBER,
    p_refund_amount OUT NUMBER
) AS
    v_status smartmove_database.bookings.status%TYPE;
    v_departure DATE;
    v_payment_id NUMBER;
    v_payment_amount NUMBER;
    v_refund_id NUMBER;
BEGIN
    p_changed := 0;
    p_refund_amount := 0;
    SELECT status
    INTO v_status
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id
      AND passenger_id = p_passenger_id
    FOR UPDATE;

    IF v_status = 'CANCELLED' THEN
        SELECT NVL(MAX(r.amount), 0)
        INTO p_refund_amount
        FROM smartmove_database.payments p
        LEFT JOIN smartmove_database.refunds r ON r.payment_id = p.payment_id
        WHERE p.booking_id = p_booking_id;
        RETURN;
    END IF;

    SELECT t.departure_at
    INTO v_departure
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id;
    IF v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20021, 'Trip has departed.');
    END IF;

    IF v_status = 'CONFIRMED' THEN
        SELECT payment_id, amount
        INTO v_payment_id, v_payment_amount
        FROM smartmove_database.payments
        WHERE booking_id = p_booking_id;
    END IF;

    smartmove_database.cancel_booking(p_booking_id);
    IF v_status = 'CONFIRMED' THEN
        v_refund_id := smartmove_database.web_refund_seq.NEXTVAL;
        smartmove_database.process_refund(
            v_refund_id,
            v_payment_id,
            'Passenger cancelled before departure'
        );
        p_refund_amount := v_payment_amount;
    END IF;
    p_changed := 1;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_update_profile (
    p_passenger_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
) AS
BEGIN
    UPDATE smartmove_database.passengers
    SET full_name = TRIM(p_name), phone = TRIM(p_phone)
    WHERE passenger_id = p_passenger_id;
    IF SQL%ROWCOUNT <> 1 THEN
        RAISE_APPLICATION_ERROR(-20022, 'Passenger not found.');
    END IF;
END;
/

-- Oracle stores the reference and workflow state; MongoDB stores the content.
CREATE OR REPLACE PROCEDURE smartmove_database.web_submit_feedback (
    p_feedback_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_type IN VARCHAR2
) AS
    v_booking_status smartmove_database.bookings.status%TYPE;
    v_trip_status smartmove_database.trips.status%TYPE;
BEGIN
    SELECT b.status, t.status
    INTO v_booking_status, v_trip_status
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id
      AND b.passenger_id = p_passenger_id;
    IF p_type NOT IN ('REVIEW', 'COMPLAINT') OR p_type IS NULL THEN
        RAISE_APPLICATION_ERROR(-20023, 'Invalid feedback type.');
    END IF;
    IF p_type = 'REVIEW' AND
       (v_booking_status <> 'CONFIRMED' OR v_trip_status <> 'COMPLETED') THEN
        RAISE_APPLICATION_ERROR(-20024, 'Review requires a completed paid trip.');
    END IF;
    INSERT INTO smartmove_database.feedback_records
        (feedback_id, booking_id, feedback_type, status)
    VALUES (p_feedback_id, p_booking_id, p_type, 'OPEN');
END;
/

GRANT SELECT ON smartmove_database.web_passenger_login TO smartmove_database_app;
GRANT SELECT ON smartmove_database.payments TO smartmove_database_app;
GRANT SELECT ON smartmove_database.refunds TO smartmove_database_app;
GRANT SELECT ON smartmove_database.feedback_records TO smartmove_database_app;
GRANT SELECT ON smartmove_database.booking_status_history TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_notification_baseline TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_feedback_seq TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_cancel_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_update_profile TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_submit_feedback TO smartmove_database_app;

COMMIT;
