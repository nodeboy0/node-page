const express = require('express');
const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');

const app = express();
const port = 3000;
const mongoURI = 'mongodb://localhost:27017';
const dbName = 'pruebas';
const uploadPath = 'uploads';

app.set('view engine', 'ejs');


// Configuración de Multer para manejar la carga de archivos
const storage = multer.diskStorage({
    destination: uploadPath,
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Middleware para servir archivos estáticos
app.use(express.static(__dirname + '/public'));

// Función para conectar a la base de datos
async function connectDatabase() {
    const client = new MongoClient(mongoURI);
    await client.connect();
    return client.db(dbName);
}

// Ruta para renderizar la página principal
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para mostrar los archivos subidos
app.get('/files', async (req, res) => {
    try {
        const db = await connectDatabase();
        const filesCollection = db.collection('fs.files');
        const files = await filesCollection.find().toArray();
        res.render('files', { files });
    } catch (error) {
        console.error('Error al obtener archivos subidos:', error);
        res.status(500).send('Ocurrió un error al obtener los archivos subidos.');
    }
});

// Ruta para descargar un archivo
app.get('/download/:filename', async (req, res) => {
    try {
        const db = await connectDatabase();
        const bucket = new GridFSBucket(db);
        const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        downloadStream.pipe(res);
    } catch (error) {
        console.error('Error al descargar el archivo:', error);
        res.status(500).send('Ocurrió un error al descargar el archivo.');
    }
});

// Ruta para manejar la carga de archivos
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const db = await connectDatabase();
        const bucket = new GridFSBucket(db);
        const uploadStream = bucket.openUploadStream(req.file.filename);
        fs.createReadStream(req.file.path).pipe(uploadStream);
        uploadStream.on('finish', async () => {
            console.log('Archivo subido a MongoDB');
            await fs.promises.unlink(req.file.path); // Utilizando promesas fs
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error al subir el archivo a MongoDB:', error);
        res.status(500).json({ success: false, error: 'Error al subir el archivo a MongoDB' });
    }
});

// Ruta para eliminar un archivo por su nombre
app.post('/delete/:filename', async (req, res) => {
    try {
        const db = await connectDatabase();
        const filesCollection = db.collection('fs.files');
        const file = await filesCollection.findOne({ filename: req.params.filename });
        if (!file) return res.status(404).send('El archivo no fue encontrado en la base de datos.');
        const bucket = new GridFSBucket(db);
        await bucket.delete(file._id);
        res.redirect('/files');
    } catch (error) {
        console.error('Error al eliminar el archivo:', error);
        res.status(500).send('Ocurrió un error al eliminar el archivo.');
    }
});

// Servidor escuchando en el puerto 3000
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
