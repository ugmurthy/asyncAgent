-- Create executions view that joins dag_executions with dags to include dag_title
CREATE VIEW executions AS 
SELECT 
  d.dag_title,
  e.*
FROM dag_executions e 
INNER JOIN dags d ON e.dag_id = d.id 
ORDER BY e.updated_at DESC;
