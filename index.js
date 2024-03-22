const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtSecret = 'your_jwt_secret';
const multer = require('multer');
const path = require('path');
const app = express();



app.use(express.json());
app.use(cors());


app.use('/uploads', express.static(path.join(__dirname, '/uploads')));


const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, 'uploads/') // กำหนดไดเรกทอรีที่จะเก็บไฟล์ที่อัปโหลด
    },
    filename: function(req, file, cb) {
      // กำหนดชื่อไฟล์ - ในที่นี้เราใช้ชื่อเดิมของไฟล์ และเพิ่ม timestamp เข้าไปด้านหน้า
      // นามสกุลไฟล์จะถูกดึงมาจากชื่อไฟล์เดิม
      cb(null, Date.now() + '-' + file.originalname)
    }
  })
  
  const upload = multer({ storage: storage });

// การตั้งค่าการเชื่อมต่อฐานข้อมูล
const db = mysql.createConnection({
    user: 'upz85imdxpa8frjr',
    host: 'bmxmxakodmrnmctq9prb-mysql.services.clever-cloud.com',
    password: '2Dhqa57tXEh6zWOGzcuc',
    database: 'bmxmxakodmrnmctq9prb'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});

// ข้อมูล users
app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, result) => {
      if(err) {
          console.log(err);
          res.status(500).send('Error fetching users');
      } else {
          res.send(result);
      }
  });
});

app.get('/username', (req, res) => {
  const userId = req.query.id;

  db.query('SELECT username FROM users WHERE user_id = ?', [userId], (err, result) => {
      if (err) {
          res.status(500).send({ error: err.message });
      } else {
          if (result.length > 0) {
              res.json({ username: result[0].username });
          } else {
              res.status(404).send({ error: 'User not found' });
          }
      }
  });
});

// ข้อมูลจังหวัด
app.get('/provinces', (req, res) => {
  db.query('SELECT * FROM thai_provinces', (err, result) => {
      if(err) {
          console.log(err);
          res.status(500).send('Error fetching users');
      } else {
          res.send(result);
      }
  });
});

// ข้อมูลอสังหา
app.get('/listings', (req, res) => {
    db.query('SELECT listings.user_id, listings.listing_id, listings.type_id, listings.title, listings.size, listings.num_bedrooms, listings.num_bathrooms, listings.address, listings.subdistricts, listings.districts, listings.province, listings.zip_code, listings.price, listings.description, listings.updated_at, listings.status, listing_images.image_url, users.username, users.email, users.phone_number FROM listings JOIN listing_images ON listings.listing_id = listing_images.listing_id JOIN users ON listings.user_id = users.user_id;', (err, result) => {
        if(err) {
            console.log(err);
            res.status(500).send('Error fetching users');
        } else {
            res.send(result);
        }
    });
});

// ลบข้อมูล สมาชิก
app.delete('/users/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query('DELETE FROM users WHERE user_id = ?', [userId], (err, result) => {
      if (err) {
          console.error('Error deleting user:', err);
          res.status(500).send('Error deleting user');
      } else {
          res.status(200).send(`User with ID ${userId} deleted`);
      }
  });
});

// ลบข้อมูลอสังหา
app.delete('/listings/:listingId', (req, res) => {
  const listingId = req.params.listingId;
  db.query('DELETE FROM listings WHERE listing_id = ?', [listingId], (err, result) => {
      if (err) {
          console.error('Error deleting listing:', err);
          res.status(500).send('Error deleting listing');
      } else {
          res.status(200).send(`Listing with ID ${listingId} deleted`);
      }
  });
});


// filter ข้อมูลอสังหา
app.post('/filter', (req, res) => {
  const { selectedProvince, areaSize, price } = req.body; // รับค่าจาก request body

  // สร้าง SQL query โดยใช้ค่าที่ได้รับ
  const sqlQuery = `
      SELECT listings.user_id, listings.listing_id, listings.type_id, listings.title, listings.size, listings.num_bedrooms, listings.num_bathrooms, listings.address, listings.subdistricts, listings.districts, listings.province, listings.zip_code, listings.price, listings.description, listings.updated_at, listings.status, listing_images.image_url, users.username, users.email, users.phone_number
      FROM listings
      JOIN listing_images ON listings.listing_id = listing_images.listing_id
      JOIN users ON listings.user_id = users.user_id
      WHERE listings.province = ? AND listings.size >= ? AND listings.price <= ?;
  `;

  db.query(sqlQuery, [selectedProvince, areaSize, price], (err, result) => {
      if(err) {
          console.log(err);
          res.status(500).send('Error in query');
      } else {
          res.send(result);
      }
  });
});


app.post('/register', async (req, res) => {
    const { username, password, email, phone_number } = req.body;

    try {
        // Encrypt the password
        const hashedPassword = await bcrypt.hash(password, 8);

        // Insert user into the database
        db.query(
            'INSERT INTO users (username, password, email, phone_number) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, email, phone_number],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error registering new user');
                } else {
                    res.status(201).send('User registered');
                }
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user by username
        db.query('SELECT * FROM users WHERE username = ?', [username], async (err, result) => {
            if (err) throw err;

            if (result.length > 0) {
                // Compare the passwords
                const comparisonResult = await bcrypt.compare(password, result[0].password);
                if (comparisonResult) {
                    // Passwords match
                    const token = jwt.sign({ id: result[0].user_id }, 'your_jwt_secret', { expiresIn: '1h' }); 
                    res.json({ token });
                } else {
                    res.status(401).send('Incorrect password');
                }
            } else {
                res.status(404).send('User not found');
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.post('/logout', (req, res) => {
    res.status(200).send('Logged out');
  });


  
app.post('/create-listing', upload.array('images'), (req, res) => {
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).send('Access Token Required');
    }
  
    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        return res.status(403).send('Invalid/Expired token');
      }
  
      const { title, description, type_id, price, size, num_bedrooms, num_bathrooms, address, subdistricts, districts, province, zip_code } = req.body;
      const user_id = user.id; // retrieves user_id from JWT payload
      const images = req.files; // ไฟล์รูปภาพจะอยู่ใน req.files
  
      // สร้าง listing ใหม่
      db.query(
        'INSERT INTO listings (user_id, type_id, title, description, price, size, num_bedrooms, num_bathrooms, address, subdistricts, districts, province, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user_id, type_id, title, description, price, size, num_bedrooms, num_bathrooms, address, subdistricts, districts, province, zip_code],
        (err, result) => {
          if (err) {
            console.log(err);
            res.status(500).send('Error creating listing');
          } else {
            const listingId = result.insertId;
            if (images) {
              // อัพโหลดรูปภาพลงในฐานข้อมูล
              images.forEach(image => {
                db.query('INSERT INTO listing_images (listing_id, image_url) VALUES (?, ?)',
                  [listingId, image.path], // image.path คือตำแหน่งที่เก็บไฟล์
                  (err, result) => {
                    if (err) {
                      console.log(err);
                      // handle error
                    } else {
                      // success
                    }
                  }
                );
              });
            }
            res.status(201).send('Listing created');
          }
        }
      );
    });
  });

  app.put('/update-listing/:id', (req, res) => {
    const id = req.params.id;
    const { title, description, type_id, price, size, num_bedrooms, num_bathrooms, address, subdistricts, districts, province, zip_code, status } = req.body;

    const query = `
        UPDATE listings 
        SET title = ?, description = ?, type_id = ?, price = ?, size = ?, 
            num_bedrooms = ?, num_bathrooms = ?, address = ?, 
            subdistricts = ?, districts = ?, province = ?, zip_code = ?, status = ?
        WHERE listing_id = ?
    `;

    db.query(query, [title, description, type_id, price, size, num_bedrooms, num_bathrooms, address, subdistricts, districts, province, zip_code, status, id], (err, result) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Server error');
        } else {
            res.status(200).send('Listing updated successfully');
        }
    });
});



// ตั้งค่า server ให้รันบน port 3001
app.listen(3001, () => {
    console.log('Server is running on port 3001');
});
