const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');



const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// MySQL database connection
const dbConfig = {
  host: 'srv808637.hstgr.cloud',
  user: 'admin',
  password: 'admin@123', // Change this to your MySQL password
  database: 'item_management'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1); // Exit if database connection fails
  }
}

// Routes

// Get all main items
app.get('/api/main-items', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM main_items ORDER BY item_no');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching main items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search main item and get its BOM (Bill of Materials)
app.get('/api/main-items/:itemNo/bom', async (req, res) => {
  try {
    const { itemNo } = req.params;
    
    // Get main item details
    const [mainItem] = await pool.execute(
      'SELECT * FROM main_items WHERE item_no = ?',
      [itemNo]
    );

    if (mainItem.length === 0) {
      return res.status(404).json({ error: 'Main item not found' });
    }

    // Get child items with quantities
    const [childItems] = await pool.execute(`
      SELECT 
        ir.child_item_no,
        ci.item_name as child_item_name,
        ir.quantity,
        ir.item_relation
      FROM item_relationships ir
      JOIN child_items ci ON ir.child_item_no = ci.item_no
      WHERE ir.main_item_no = ?
      ORDER BY ir.child_item_no
    `, [itemNo]);

    const result = {
      mainItem: mainItem[0],
      childItems: childItems,
      totalComponents: childItems.length,
      totalQuantity: childItems.reduce((sum, item) => sum + item.quantity, 0)
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search main items by partial item number or name
app.get('/api/search/main-items', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.json([]);
    }

    const [rows] = await pool.execute(`
      SELECT * FROM main_items 
      WHERE item_no LIKE ? OR item_name LIKE ?
      ORDER BY item_no
      LIMIT 10
    `, [`%${query}%`, `%${query}%`]);

    res.json(rows);
  } catch (error) {
    console.error('Error searching main items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload and process Excel file
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let processedItems = 0;
    let errors = [];

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const row of data) {
        try {
          // Insert or update main item
          await connection.execute(`
            INSERT INTO main_items (item_no, item_name) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE item_name = VALUES(item_name)
          `, [row['Main Item No'], row['Main Item Name']]);

          // Insert or update child item
          await connection.execute(`
            INSERT INTO child_items (item_no, item_name) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE item_name = VALUES(item_name)
          `, [row['Child Item No'], row['Child Item Name']]);

          // Insert or update relationship
          await connection.execute(`
            INSERT INTO item_relationships (main_item_no, child_item_no, quantity, item_relation) 
            VALUES (?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), item_relation = VALUES(item_relation)
          `, [row['Main Item No'], row['Child Item No'], row['Qty'] || 1, row['I/R'] || 'I']);

          processedItems++;
        } catch (itemError) {
          errors.push({
            row: row,
            error: itemError.message
          });
        }
      }

      await connection.commit();
      
      res.json({
        success: true,
        processedItems,
        totalRows: data.length,
        errors: errors.length > 0 ? errors : null
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ error: 'Error processing Excel file' });
  }
});

// Generate BOM report as JSON
app.get('/api/reports/bom/:itemNo', async (req, res) => {
  try {
    const { itemNo } = req.params;
    
    const [mainItem] = await pool.execute(
      'SELECT * FROM main_items WHERE item_no = ?',
      [itemNo]
    );

    if (mainItem.length === 0) {
      return res.status(404).json({ error: 'Main item not found' });
    }

    const [childItems] = await pool.execute(`
      SELECT 
        ir.child_item_no,
        ci.item_name as child_item_name,
        ir.quantity,
        ir.item_relation
      FROM item_relationships ir
      JOIN child_items ci ON ir.child_item_no = ci.item_no
      WHERE ir.main_item_no = ?
      ORDER BY ir.child_item_no
    `, [itemNo]);

    const report = {
      title: `Bill of Materials Report`,
      mainItem: {
        itemNo: mainItem[0].item_no,
        itemName: mainItem[0].item_name
      },
      components: childItems.map(item => ({
        itemNo: item.child_item_no,
        itemName: item.child_item_name,
        quantity: item.quantity,
        relation: item.item_relation
      })),
      summary: {
        totalComponents: childItems.length,
        totalQuantity: childItems.reduce((sum, item) => sum + item.quantity, 0)
      },
      generatedAt: new Date().toISOString()
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating BOM report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  await testDatabaseConnection();
});