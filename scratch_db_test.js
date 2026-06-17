const path = require('path');
const fs = require('fs');
const database = require('./db/database');

console.log("Database initialized. Initial db state:", database.db ? "Open" : "Closed");

// Wait 1.5 seconds for database connection to be established asynchronously
setTimeout(() => {
  console.log("DB instance after initialization:", database.db ? "Open" : "Closed");
  
  // Test 1: Reset Database
  console.log("Testing Reset Database...");
  database.dbHelpers.resetDatabase((err) => {
    if (err) {
      console.error("Reset Database failed:", err);
      process.exit(1);
    }
    console.log("Reset Database successful.");
    
    // Create a backup file path
    const backupPath = path.join(__dirname, 'db', 'portfolio_backup.db');
    const dbPath = path.join(__dirname, 'db', 'portfolio.db');
    
    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log("Backup file created.");
    } catch (e) {
      console.error("Backup file creation failed:", e);
      process.exit(1);
    }
    
    // Test 2: Restore Database
    console.log("Testing Restore Database...");
    database.dbHelpers.restoreDatabaseFromFile(backupPath, (restoreErr) => {
      if (restoreErr) {
        console.error("Restore Database failed:", restoreErr);
        process.exit(1);
      }
      console.log("Restore Database successful.");
      
      // Let's do another query to make sure the connection is fully working
      database.dbHelpers.getAllCategories((err, categories) => {
        if (err) {
          console.error("Query after restore failed:", err);
          process.exit(1);
        }
        console.log("Query after restore succeeded. Categories found:", categories.length);
        
        // Clean up backup file
        try {
          fs.unlinkSync(backupPath);
        } catch (e) {}
        
        console.log("All tests passed successfully!");
        process.exit(0);
      });
    });
  });
}, 1500);
