import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

const conectarDB = async () => {
    if (!MONGO_URI) {
        console.error("🔴 Error: La variable de entorno MONGODB_URI no está definida.");
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log(`🟢 Conectado a MongoDB Atlas en la base de datos: ${mongoose.connection.name}`);
    } catch (error) {
        console.error("🔴 Error conectando a MongoDB:", error.message);
        process.exit(1);
    }
};

export default conectarDB;
