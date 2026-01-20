# 💰 Finance App - Gestión Financiera Colaborativa

Una solución moderna y multiplataforma (iOS, Android, Web) para la gestión de finanzas personales y grupales. Desarrollada con un enfoque **Mobile-First** utilizando el ecosistema de React Native.

🔗 **Demo Web:** [miguelolteanu.dev/finances](https://miguelolteanu.dev/finances)

## ⚡ Tech Stack & Arquitectura

* **Core:** React Native + Expo SDK 50+
* **Navegación:** Expo Router (File-based routing)
* **Lenguaje:** TypeScript (Strict Typing)
* **Backend as a Service:** Firebase (Auth & Firestore)
* **Estilos:** `StyleSheet` nativo (Sin librerías de UI pesadas para máximo rendimiento)
* **Persistencia:** AsyncStorage + Firebase Persistence

## 🚀 Funcionalidades Clave

* **Autenticación Personalizada:** Sistema de login "Username-only" (abstracción sobre Email/Pass) con manejo de errores en tiempo real.
* **Economía Colaborativa:** Creación de grupos financieros con códigos únicos de invitación (`inviteCode`) y permisos de lectura/escritura granulares.
* **Multi-Divisa Inteligente:** Soporte nativo para EUR, USD y COP con formateo automático de inputs en tiempo real.
* **Modo Oscuro Adaptativo:** Implementación de temas semánticos respetando las preferencias del sistema operativo.
* **Seguridad:** Reglas de seguridad en Firestore (Row Level Security) asegurando que solo los miembros de un `accountId` pueden leer sus transacciones.

---
Desarrollado por [Miguel Olteanu](https://miguelolteanu.dev) - Ingeniería del Software UPM.