# Reglas de Seguridad de Firestore - Explicación Detallada

## Visión General

Las reglas de seguridad de Firestore son **críticas** para proteger los datos de la aplicación de finanzas. Estas reglas garantizan que los usuarios solo puedan acceder a las cuentas y transacciones donde tienen permisos explícitos como miembros.

## Principio Fundamental: Control de Acceso Basado en Miembros

**REGLA CRÍTICA**: Los usuarios solo pueden leer/escribir en cuentas donde su `auth.uid` está presente en el array `memberIds` de la cuenta.

Este principio se aplica en cascada:
- Si un usuario no es miembro de una cuenta → No puede ver la cuenta
- Si un usuario no es miembro de una cuenta → No puede ver las transacciones de esa cuenta
- Si un usuario no es miembro de una cuenta → No puede crear transacciones en esa cuenta

---

## 1. Colección `users` - Perfiles de Usuario

### Reglas Aplicadas

```javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
  allow delete: if false;
}
```

### Explicación

- **Lectura**: Solo el propio usuario puede leer su perfil (`auth.uid == userId`)
- **Creación**: Solo al registrarse, el usuario puede crear su propio perfil
- **Actualización**: Solo el propio usuario puede actualizar su perfil
- **Eliminación**: Deshabilitada por seguridad (opcionalmente se puede permitir)

### Seguridad

✅ **Protegido contra**: Usuarios que intentan leer/modificar perfiles de otros usuarios

---

## 2. Colección `accounts` - Cuentas/Carteras

### Regla Crítica: Verificación de Miembros

La verificación clave es:
```javascript
request.auth.uid in resource.data.memberIds
```

Esta línea verifica que el `auth.uid` del usuario autenticado está presente en el array `memberIds` del documento de la cuenta.

### 2.1. Lectura de Cuentas (`read`)

```javascript
allow read: if request.auth != null 
            && request.auth.uid in resource.data.memberIds;
```

**Explicación**:
- El usuario debe estar autenticado (`request.auth != null`)
- El `auth.uid` del usuario debe estar en `memberIds` de la cuenta

**Resultado**: Solo los miembros de una cuenta pueden verla en queries y lecturas individuales.

**Escenario de Ataque Bloqueado**:
```
Usuario malintencionado intenta:
  db.collection('accounts').doc('account123').get()
  
Si su auth.uid NO está en memberIds de account123:
  → La regla deniega el acceso
  → No puede leer la cuenta
```

### 2.2. Creación de Cuentas (`create`)

```javascript
allow create: if request.auth != null
            && request.resource.data.ownerId == request.auth.uid
            && request.auth.uid in request.resource.data.memberIds
            && // validaciones de estructura...
```

**Explicación**:
- El usuario debe ser el propietario (`ownerId == auth.uid`)
- El usuario debe estar incluido en `memberIds` (siempre es miembro de sus propias cuentas)
- Se valida la estructura de datos (tipo, moneda, etc.)

**Resultado**: Los usuarios solo pueden crear cuentas donde son propietarios y miembros.

**Escenario de Ataque Bloqueado**:
```
Usuario malintencionado intenta:
  db.collection('accounts').add({
    name: "Cuenta Robada",
    ownerId: "otroUsuarioId",  // ← NO es su propia ID
    memberIds: ["otroUsuarioId"]
  })
  
→ La regla deniega porque ownerId != auth.uid
```

### 2.3. Actualización de Cuentas (`update`)

```javascript
allow update: if request.auth != null
              && request.auth.uid == resource.data.ownerId
              && request.auth.uid in resource.data.memberIds
              && request.auth.uid in request.resource.data.memberIds
              && resource.data.ownerId == request.resource.data.ownerId
```

**Explicación**:
- Solo el propietario puede actualizar
- El propietario debe permanecer en `memberIds` (tanto antes como después)
- El `ownerId` no puede cambiarse

**Resultado**: Solo el propietario puede modificar la cuenta, y no puede excluirse a sí mismo.

**Escenarios Protegidos**:
1. **Cambio no autorizado de propietario**:
   ```
   Usuario intenta cambiar ownerId:
     → resource.data.ownerId == request.resource.data.ownerId (bloqueado)
   ```

2. **Auto-exclusión como propietario**:
   ```
   Propietario intenta removerse de memberIds:
     → request.auth.uid in request.resource.data.memberIds (bloqueado)
   ```

### 2.4. Eliminación de Cuentas (`delete`)

```javascript
allow delete: if request.auth != null 
              && resource.data.ownerId == request.auth.uid;
```

**Explicación**: Solo el propietario puede eliminar la cuenta.

**Nota de Seguridad**: Al eliminar una cuenta, considera eliminar también todas las transacciones asociadas mediante Cloud Functions.

---

## 3. Colección `transactions` - Transacciones

### Regla Crítica: Verificación de Membresía en Cuenta

La verificación clave requiere **consultar la cuenta asociada**:

```javascript
function isAccountMember() {
  let account = firestore.get(/databases/$(database)/documents/accounts/$(resource.data.accountId));
  return request.auth != null 
         && account != null
         && request.auth.uid in account.data.memberIds;
}
```

Esta función:
1. Obtiene el documento de la cuenta usando `accountId`
2. Verifica que el usuario está en `memberIds` de esa cuenta

### 3.1. Lectura de Transacciones (`read`)

```javascript
allow read: if isAccountMember();
```

**Explicación**:
- Se consulta la cuenta asociada (`accountId` de la transacción)
- Se verifica que `auth.uid` está en `memberIds` de esa cuenta

**Resultado**: Los usuarios solo pueden ver transacciones de cuentas donde son miembros.

**Cascada de Seguridad**:
```
Query de transacciones:
  db.collection('transactions')
    .where('accountId', '==', 'account123')
    .get()

Para cada transacción:
  1. Firestore verifica que auth.uid está en memberIds de account123
  2. Si NO está → La transacción se filtra automáticamente
  3. Solo se retornan transacciones de cuentas accesibles
```

**Escenario de Ataque Bloqueado**:
```
Usuario malintencionado intenta:
  db.collection('transactions').doc('trans123').get()
  
La transacción pertenece a account456:
  → Se consulta account456
  → Si auth.uid NO está en memberIds de account456
  → La regla deniega el acceso
  → No puede leer la transacción
```

### 3.2. Creación de Transacciones (`create`)

```javascript
allow create: if canCreateTransaction()
              && request.resource.data.userId == request.auth.uid
              && // validaciones de estructura...
```

**Explicación**:
- `canCreateTransaction()` verifica que el usuario es miembro de la cuenta
- `userId` debe coincidir con `auth.uid` (no puedes crear transacciones a nombre de otros)

**Resultado**: Los usuarios solo pueden crear transacciones en cuentas donde son miembros.

**Escenario de Ataque Bloqueado**:
```
Usuario malintencionado intenta:
  db.collection('transactions').add({
    accountId: "cuentaPrivadaDeOtro",
    userId: "miId",  // ← Su propia ID
    amount: 1000
  })
  
→ Se consulta la cuenta "cuentaPrivadaDeOtro"
→ Si auth.uid NO está en memberIds
→ La regla deniega la creación
```

### 3.3. Actualización de Transacciones (`update`)

```javascript
allow update: if isAccountMember()
              && request.resource.data.accountId == resource.data.accountId
              && request.resource.data.id == resource.data.id
              && request.resource.data.amount > 0;
```

**Explicación**:
- El usuario debe ser miembro de la cuenta
- No se puede cambiar el `accountId` (mover transacción a otra cuenta)
- El `id` no puede cambiarse
- El monto debe ser positivo

**Escenario de Ataque Bloqueado**:
```
Usuario intenta mover transacción a otra cuenta:
  transaction.update({ accountId: "cuentaPrivada" })
  
→ request.resource.data.accountId == resource.data.accountId (bloqueado)
```

### 3.4. Eliminación de Transacciones (`delete`)

```javascript
allow delete: if isAccountMember();
```

**Explicación**: Cualquier miembro de la cuenta puede eliminar transacciones.

**Alternativa más restrictiva**: Si solo el creador puede eliminar:
```javascript
allow delete: if isAccountMember() 
              && resource.data.userId == request.auth.uid;
```

---

## Consideraciones de Rendimiento

### Consultas Cruzadas (Cross-Document Queries)

Las reglas de transacciones requieren consultar la cuenta para cada operación:

```javascript
let account = firestore.get(/databases/$(database)/documents/accounts/$(accountId));
```

**Impacto**:
- Cada lectura/escritura de transacción ejecuta una lectura adicional de la cuenta
- Esto consume **lecturas de Firestore** adicionales
- Para optimizar, considera:
  - Cachear información de membresía en el cliente
  - Usar índices compuestos para queries eficientes
  - Mantener `memberIds` actualizados y correctos

### Validación de Estructura

Las reglas validan la estructura de datos en creación/actualización:

```javascript
&& request.resource.data.type in ['INDIVIDUAL', 'GROUP']
&& request.resource.data.currency in ['EUR', 'USD', 'COP']
&& request.resource.data.amount > 0
```

**Beneficio**: Previene datos mal formados antes de que se escriban.

---

## Resumen de Seguridad por Caso de Uso

| Operación | Condición de Acceso | Protección Contra |
|-----------|---------------------|-------------------|
| Leer cuenta | `auth.uid in memberIds` | Lectura no autorizada de cuentas |
| Crear cuenta | `auth.uid == ownerId` | Crear cuentas con otro dueño |
| Actualizar cuenta | `auth.uid == ownerId` | Modificar cuentas no propias, cambiar propietario |
| Eliminar cuenta | `auth.uid == ownerId` | Eliminar cuentas de otros |
| Leer transacción | `auth.uid in account.memberIds` | Ver transacciones de cuentas privadas |
| Crear transacción | `auth.uid in account.memberIds` | Crear transacciones en cuentas no accesibles |
| Actualizar transacción | `auth.uid in account.memberIds` | Modificar transacciones, mover entre cuentas |
| Eliminar transacción | `auth.uid in account.memberIds` | Eliminar transacciones no accesibles |

---

## Mejores Prácticas Aplicadas

✅ **Principio de Menor Privilegio**: Los usuarios solo tienen acceso a lo que necesitan  
✅ **Verificación en Cascada**: Las transacciones heredan la seguridad de las cuentas  
✅ **Validación de Estructura**: Se validan tipos y rangos de datos  
✅ **Inmutabilidad de IDs**: Los IDs y referencias críticas no pueden cambiarse  
✅ **Datos Consistentes**: Se asegura que `ownerId` esté siempre en `memberIds`  

---

## Notas Finales

1. **Testing de Reglas**: Prueba estas reglas en el simulador de Firestore antes de desplegar
2. **Logs y Monitoreo**: Monitorea los intentos de acceso denegados en Firebase Console
3. **Actualización de Reglas**: Cuando actualices reglas, verifica que no rompas funcionalidad existente
4. **Cloud Functions**: Considera usar Cloud Functions para operaciones complejas que requieran múltiples validaciones

---

## Comandos Útiles

### Desplegar Reglas
```bash
firebase deploy --only firestore:rules
```

### Probar Reglas Localmente
```bash
firebase emulators:start --only firestore
```

### Ver Logs de Reglas
```
Firebase Console → Firestore → Rules → Ver logs de evaluación
```
