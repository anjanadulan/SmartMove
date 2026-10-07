CREATE OR REPLACE PROCEDURE smartmove_database.web_revenue_period (
    p_start_date IN DATE,
    p_end_date   IN DATE
) AS
    v_total_payments NUMBER := 0;
    v_total_refunds  NUMBER := 0;
    v_net_revenue    NUMBER := 0;
BEGIN
    SELECT NVL(SUM(amount), 0)
    INTO v_total_payments
    FROM smartmove_database.payments
    WHERE paid_at >= p_start_date AND paid_at < p_end_date + 1;

    SELECT NVL(SUM(amount), 0)
    INTO v_total_refunds
    FROM smartmove_database.refunds
    WHERE refunded_at >= p_start_date AND refunded_at < p_end_date + 1;

    v_net_revenue := v_total_payments - v_total_refunds;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('REVENUE PERIOD REPORT (' || TO_CHAR(p_start_date, 'YYYY-MM-DD') || ' to ' || TO_CHAR(p_end_date, 'YYYY-MM-DD') || ')');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('Total Payments : LKR ' || v_total_payments);
    DBMS_OUTPUT.PUT_LINE('Total Refunds  : LKR ' || v_total_refunds);
    DBMS_OUTPUT.PUT_LINE('Net Revenue    : LKR ' || v_net_revenue);
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
END web_revenue_period;
/

GRANT EXECUTE ON smartmove_database.popular_routes TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.revenue TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.passenger_history TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.maintenance_due TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.trip_occupancy TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_revenue_period TO smartmove_database_app;
COMMIT;
