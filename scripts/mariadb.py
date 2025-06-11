import mariadb
import sys

# Instantiate Connection
try:
   conn = mariadb.connect(
      host="127.0.0.1",
      port=3306,
      user="resomixAdmin",
      password="G351vVD-usman2212!")
except mariadb.Error as e:
   print(f"Error connecting to the database: {e}")
   sys.exit(1)

# Use Connection
# display all tables
cursor = conn.cursor()
cursor.execute("SHOW TABLES")

for table in cursor:
    print(table)

# Close Connection
conn.close()
