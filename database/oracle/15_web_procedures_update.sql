-- Update web procedures to match Next.js application signatures
CREATE OR REPLACE PROCEDURE smartmove_database.web_register_passenger (
    p_email IN VARCHAR2,
    p_password_hash IN VARCHAR2,
    p_full_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_user_id IN NUMBER,
    p_passenger_id IN NUMBER
) AS
BEGIN
    INSERT INTO smartmove_database.app_users (user_id, email, password_hash, role)
    VALUES (p_user_id, LOWER(TRIM(p_email)), p_password_hash, 'PASSENGER');
    INSERT INTO smartmove_database.passengers (passenger_id, user_id, full_name, phone)
    VALUES (p_passenger_id, p_user_id, TRIM(p_full_name), TRIM(p_phone));
END web_register_passenger;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_update_profile (
    p_passenger_id IN NUMBER,
    p_full_name    IN VARCHAR2,
    p_phone        IN VARCHAR2
) AS
BEGIN
    UPDATE smartmove_database.passengers
    SET full_name = TRIM(p_full_name),
        phone = TRIM(p_phone)
    WHERE passenger_id = p_passenger_id;
END web_update_profile;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_cancel_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_refund_id IN NUMBER,
    p_changed OUT NUMBER,
    p_refund_amount OUT NUMBER
) AS
    v_status smartmove_database.bookings.status%TYPE;
    v_departure DATE;
    v_payment_id NUMBER;
    v_payment_amount NUMBER;
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
        RAISE_APPLICATION_ERROR(-20005, 'Past departures cannot be cancelled.');
    END IF;

    UPDATE smartmove_database.tickets
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    UPDATE smartmove_database.bookings
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    p_changed := 1;

    BEGIN
        SELECT payment_id, amount
        INTO v_payment_id, v_payment_amount
        FROM smartmove_database.payments
        WHERE booking_id = p_booking_id;

        INSERT INTO smartmove_database.refunds (refund_id, payment_id, amount, reason)
        VALUES (p_refund_id, v_payment_id, v_payment_amount, 'Passenger requested cancellation');

        p_refund_amount := v_payment_amount;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_refund_amount := 0;
    END;
END web_cancel_booking;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_submit_feedback (
    p_feedback_id  IN NUMBER,
    p_booking_id   IN NUMBER,
    p_passenger_id IN NUMBER,
    p_type         IN VARCHAR2
) AS
    v_count NUMBER;
BEGIN
    IF p_type = 'REVIEW' THEN
        SELECT COUNT(*)
        INTO v_count
        FROM smartmove_database.feedback_records
        WHERE booking_id = p_booking_id AND feedback_type = 'REVIEW';

        IF v_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20006, 'This trip has already been reviewed.');
        END IF;
    END IF;

    INSERT INTO smartmove_database.feedback_records (feedback_id, booking_id, feedback_type)
    VALUES (p_feedback_id, p_booking_id, p_type);
END web_submit_feedback;
/

GRANT EXECUTE ON smartmove_database.web_register_passenger TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_update_profile TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_cancel_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_submit_feedback TO smartmove_database_app;
COMMIT;
