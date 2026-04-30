<script setup>
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'


const db = getFirestore();
const coleccionRecordatorios = collection(db, 'recordatorios')
const admin = 'admin@gmail.com'
const prioridades = ['Low', 'Normal', 'High']
const pesoPrioridad = {
  High: 3,
  Normal: 2,
  Low: 1
}

const router = useRouter()
const auth = getAuth()
const texto = ref('')
const recordatorios = ref([])
const editandoId = ref(null)
const inputArchivos = ref(null)
const esAdmin = ref(false)
const textoEditado = ref('')
const usuarioActual = ref(null)
let cancelarLecturaRecordatorios = null

const logueado = ref(false)
const nombreUsuario = ref('')
const imgUsuario = ref('')
const idUsuario = ref('')
const archivo = ref(null)

onAuthStateChanged(auth, (user) => {
  esAdmin.value = user?.email === admin
  usuarioActual.value = user

  if (!user) {
    if (cancelarLecturaRecordatorios) {
      cancelarLecturaRecordatorios()
      cancelarLecturaRecordatorios = null
    }

    recordatorios.value = []
    logueado.value = false
    nombreUsuario.value = ''
    imgUsuario.value = ''
    idUsuario.value = ''
  } else {
    logueado.value = true
    nombreUsuario.value = user.displayName || user.email || 'Usuario'
    imgUsuario.value = user.photoURL || ''
    idUsuario.value = user.uid

    if (!cancelarLecturaRecordatorios) {
      const consulta = query(
        coleccionRecordatorios,
        where('usuarioId', '==', user.uid)
      )

      cancelarLecturaRecordatorios = onSnapshot(consulta, (snapshot) => {
        recordatorios.value = snapshot.docs.map((recordatorio) => normalizarRecordatorio(recordatorio))
        ordenarRecordatorios()
      }, (error) => {
        console.error('No se pudieron leer los recordatorios', error)
      })
    }
  }
})


function normalizarRecordatorio(recordatorio) {
  const datos = recordatorio.data()
  const adjunto = datos.adjunto || (
    datos.URL_archivo
      ? {
          nombre: datos.archivo || 'Archivo adjunto',
          ruta: datos.rutaArchivo || '',
          url: datos.URL_archivo
        }
      : null
  )

  return {
    id: recordatorio.id,
    texto: datos.texto || '',
    prioridad: prioridades.includes(datos.prioridad) ? datos.prioridad : 'Normal',
    creadoEn: Number(datos.creadoEn) || Date.now(),
    completado: Boolean(datos.completado),
    usuarioId: datos.usuarioId || '',
    usuarioEmail: datos.usuarioEmail || '',
    adjunto,
    animar: false
  }
}

function ordenarRecordatorios() {
  recordatorios.value.sort((a, b) => {
    const prioridad = pesoPrioridad[b.prioridad] - pesoPrioridad[a.prioridad]

    if (prioridad !== 0) {
      return prioridad
    }

    return a.creadoEn - b.creadoEn
  })
}

function totalRecordatorios() {
  return recordatorios.value.length
}

function pendientes() {
  return recordatorios.value.filter((recordatorio) => !recordatorio.completado).length
}


function adjuntarArchivo(e) {
  archivo.value = e.target.files[0] || null
}

async function anadirRecordatorio() {
  const textoLimpio = texto.value.trim()

  if (textoLimpio && usuarioActual.value) {
    try {
      let adjunto = null

      if (archivo.value) {
        const ruta = `${usuarioActual.value.uid}/${archivo.value.name}`

        const { error } = await supabase.storage
          .from('Adjuntos')
          .upload(ruta, archivo.value, {
            cacheControl: '3600',
            contentType: archivo.value.type || 'application/octet-stream',
            upsert: false
          })

        if (error) {
          throw error
        }

        const { data } = supabase.storage
          .from('Adjuntos')
          .getPublicUrl(ruta)

        adjunto = {
          nombre: archivo.value.name,
          ruta,
          url: data.publicUrl,
          tipo: archivo.value.type || '',
          tamano: archivo.value.size
        }
      }

      await addDoc(coleccionRecordatorios, {
        texto: textoLimpio,
        prioridad: 'Normal',
        creadoEn: Date.now(),
        completado: false,
        usuarioId: usuarioActual.value.uid,
        usuarioEmail: usuarioActual.value.email || '',
        adjunto,
        archivo: adjunto?.nombre || '',
        URL_archivo: adjunto?.url || '',
        rutaArchivo: adjunto?.ruta || ''
      })

      texto.value = ''
      limpiarArchivo()
    } catch (error) {
      console.error('No se pudo crear el recordatorio o subir el archivo', error)
    }
  }
}

async function cambiarPrioridad(id, prioridad) {
  const recordatorio = buscarRecordatorio(id)

  if (recordatorio) {
    try {
      await updateDoc(doc(db, 'recordatorios', id), { prioridad })
    } catch (error) {
      console.error('No se pudo cambiar la prioridad', error)
    }
  }
}

async function cambiarEstado(id) {
  const recordatorio = buscarRecordatorio(id)

  if (recordatorio) {
    try {
      await updateDoc(doc(db, 'recordatorios', id), {
        completado: !recordatorio.completado
      })
    } catch (error) {
      console.error('No se pudo cambiar el estado', error)
    }
  }
}

async function borrarRecordatorio(id) {
  try {
    const recordatorio = buscarRecordatorio(id)
    await borrarAdjuntoRecordatorio(recordatorio)
    await deleteDoc(doc(db, 'recordatorios', id))
  } catch (error) {
    console.error('No se pudo borrar el recordatorio', error)
  }
}

async function borrarCompletados() {
  const completados = recordatorios.value.filter((recordatorio) => recordatorio.completado)

  try {
    await Promise.all(
      completados.map(async (recordatorio) => {
        await borrarAdjuntoRecordatorio(recordatorio)
        await deleteDoc(doc(db, 'recordatorios', recordatorio.id))
      })
    )
  } catch (error) {
    console.error('No se pudieron borrar los recordatorios completados', error)
  }
}

function comenzarEdicion(recordatorio) {
  editandoId.value = recordatorio.id
  textoEditado.value = recordatorio.texto
}

async function guardarEdicion(id) {
  const recordatorio = buscarRecordatorio(id)
  const textoLimpio = textoEditado.value.trim()

  if (recordatorio && textoLimpio) {
    try {
      await updateDoc(doc(db, 'recordatorios', id), { texto: textoLimpio })
    } catch (error) {
      console.error('No se pudo guardar la edicion', error)
    }
  }

  cancelarEdicion()
}

function cancelarEdicion() {
  editandoId.value = null
  textoEditado.value = ''
}

function buscarRecordatorio(id) {
  return recordatorios.value.find((recordatorio) => recordatorio.id === id)
}

function tiempoCreacion(fecha) {
  const segundos = Math.floor((Date.now() - fecha) / 1000)

  if (segundos < 60) {
    return 'Añadido hace unos segundos'
  }

  const minutos = Math.floor(segundos / 60)

  if (minutos < 60) {
    return `Añadido hace ${minutos} minuto${minutos === 1 ? '' : 's'}`
  }

  const horas = Math.floor(minutos / 60)

  if (horas < 24) {
    return `Añadido hace ${horas} hora${horas === 1 ? '' : 's'}`
  }

  const dias = Math.floor(horas / 24)
  return `Añadido hace ${dias} dia${dias === 1 ? '' : 's'}`
}

function cerrarSesion() {
  signOut(auth)
    .then(() => {
      router.push({ name: 'landing' })
    })
    .catch((error) => {
      console.error('No se pudo cerrar la sesion', error)
    })
}

function accederAdmin(){
  router.push({ name: 'administracion' })
}

function seleccionarArchivos(event) {
  adjuntarArchivo(event)
}

function limpiarArchivo() {
  archivo.value = null

  if (inputArchivos.value) {
    inputArchivos.value.value = ''
  }
}

async function borrarAdjuntoRecordatorio(recordatorio) {
  if (recordatorio?.adjunto?.ruta) {
    const { error } = await supabase.storage
      .from('Adjuntos')
      .remove([recordatorio.adjunto.ruta])

    if (error) {
      console.error('No se pudo borrar el adjunto', error)
    }
  }
}

onUnmounted(() => {
  if (cancelarLecturaRecordatorios) {
    cancelarLecturaRecordatorios()
  }
})
</script>

<template>
  <main class="pagina-recordatorios">
    <header class="cabecera">
        <h1>Tus recordatorios</h1>
        <img
          v-if="imgUsuario"
          :src="imgUsuario"
          alt="foto de perfil"
          class="avatar"
        >
        <p class="bienvenida">Bienvenid@ {{ nombreUsuario }}</p>
      <button class="btn-sesion" type="button" @click="cerrarSesion">Cerrar sesion</button>
      <button class="btn-sesion" v-if="esAdmin==true" type="button" @click="accederAdmin">Acceder al panel de Administración</button>
    </header>

    <section class="contenedor">
      <input
        v-model="texto"
        class="input-principal"
        type="text"
        placeholder="Qué quieres recordar?"
        @keyup.enter="anadirRecordatorio"
      />
      <input
        ref="inputArchivos"
        class="input-archivos"
        type="file"
        @change="seleccionarArchivos"
      >

      <div class="resumen">
        <span class="contador">
          {{ pendientes() }} Tareas pendientes de un total de {{ totalRecordatorios() }}
        </span>
        <button class="limpiar" type="button" @click="borrarCompletados">
          Borrar tareas completadas
        </button>
      </div>

      <TransitionGroup name="recordatorio" tag="ul" class="lista-recordatorios">
        <li
          v-for="recordatorio in recordatorios"
          :key="recordatorio.id"
          class="recordatorio"
          :class="{
            completado: recordatorio.completado,
            nuevo: recordatorio.animar
          }"
        >
        
          <button
            class="estado"
            type="button"
            :aria-label="recordatorio.completado ? 'Marcar pendiente' : 'Marcar completado'"
            @click="cambiarEstado(recordatorio.id)"
          >
            <span v-if="recordatorio.completado">&#10003;</span>
          </button>

          <div class="contenido-recordatorio">
            <form
              v-if="editandoId === recordatorio.id"
              class="editor"
              @submit.prevent="guardarEdicion(recordatorio.id)"
            >
              <input
                v-model="textoEditado"
                class="input-edicion"
                type="text"
                @keyup.esc="cancelarEdicion"
              />
              <button class="btn-editor guardar" type="submit">Guardar</button>
              <button class="btn-editor" type="button" @click="cancelarEdicion">
                Cancelar
              </button>
            </form>

            <button
              v-else
              class="texto-recordatorio"
              type="button"
              @click="comenzarEdicion(recordatorio)"
            >
              {{ recordatorio.texto }}
            </button>

            <div class="meta">
              <span>Prioridad:</span>
              <button
                v-for="prioridad in prioridades"
                :key="prioridad"
                class="prioridad"
                :class="[
                  prioridad.toLowerCase(),
                  { activa: recordatorio.prioridad === prioridad }
                ]"
                type="button"
                @click="cambiarPrioridad(recordatorio.id, prioridad)"
              >
                {{ prioridad }}
              </button>
              <span class="tiempo"> {{ tiempoCreacion(recordatorio.creadoEn) }}</span>
            </div>

            <div v-if="recordatorio.adjunto" class="adjuntos">
              <a
                :href="recordatorio.adjunto.url"
                target="_blank"
                rel="noopener noreferrer"
                class="adjunto"
              >
                {{ recordatorio.adjunto.nombre }}
              </a>
            </div>

          </div>

          <button
            class="borrar"
            type="button"
            aria-label="Borrar recordatorio"
            @click="borrarRecordatorio(recordatorio.id)"
          >
            &minus;
          </button>
        </li>
      </TransitionGroup>
    </section>

  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #111827;
  color: #eef6ff;
  font-family: Arial, Helvetica, sans-serif;
}

.pagina-recordatorios {
  min-height: 100vh;
  padding: 40px 24px;
  box-sizing: border-box;
  background:
    linear-gradient(155deg, rgba(56, 189, 248, 0.2), transparent 34%),
    linear-gradient(25deg, rgba(124, 58, 237, 0.18), transparent 32%),
    #111827;
}

.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  width: min(100%, 980px);
  margin: 0 auto 28px;
}

.cabecera h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.2;
}

.btn-sesion {
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 11px 16px;
  background: #1e293b;
  color: #eef6ff;
  cursor: pointer;
}

.btn-sesion:hover {
  background: #27364f;
}

.contenedor {
  width: min(100%, 980px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 24px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.42);
}

.input-principal {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #3b82f6;
  border-radius: 7px;
  padding: 18px 20px;
  background: #eff6ff;
  color: #172033;
  font-size: 18px;
  outline: none;
}

.input-principal:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}

.input-principal::placeholder {
  color: #718096;
}

.input-archivos {
  width: 100%;
  box-sizing: border-box;
  margin-top: 12px;
  border: 1px dashed #334155;
  border-radius: 7px;
  padding: 12px;
  background: #172033;
  color: #dbeafe;
}

.resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
  padding: 14px 2px 18px;
  font-size: 13px;
  font-weight: 700;
}

.contador {
  color: #dbeafe;
}

.limpiar {
  border: 0;
  padding: 0;
  background: transparent;
  color: #93c5fd;
  font: inherit;
  cursor: pointer;
}

.limpiar:hover {
  text-decoration: underline;
}

.lista-recordatorios {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recordatorio {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 18px;
  min-height: 78px;
  padding: 16px 16px 16px 18px;
  border: 1px solid #334155;
  border-radius: 7px;
  background: #172033;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.recordatorio:hover {
  border-color: #60a5fa;
  background: #1e2a44;
  transform: translateY(-1px);
}

.recordatorio.nuevo {
  animation: aparecer 0.45s ease-out;
}

.estado {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 3px solid #dbeafe;
  border-radius: 50%;
  background: transparent;
  color: #38bdf8;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}

.completado .estado {
  border-color: #38bdf8;
}

.contenido-recordatorio {
  min-width: 0;
}

.texto-recordatorio {
  display: block;
  max-width: 100%;
  overflow: hidden;
  border: 0;
  padding: 0;
  background: transparent;
  color: #f8fbff;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  text-overflow: ellipsis;
  cursor: pointer;
}

.completado .texto-recordatorio {
  color: #7dd3fc;
  text-decoration: line-through;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: #a8b8d8;
  font-size: 13px;
}

.avatar{
    border-radius: 50%;
    width: 9rem;
    height: 9rem;
}

.prioridad {
  border: 0;
  border-radius: 999px;
  padding: 4px 10px;
  background: #25324b;
  color: #bfdbfe;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.prioridad.activa {
  color: #fff;
}

.prioridad.low.activa {
  background: #38bdf8;
  color: #082f49;
}

.prioridad.normal.activa {
  background: #3b82f6;
}

.prioridad.high.activa {
  background: #7c3aed;
}

.tiempo {
  margin-left: 10px;
}

.adjuntos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.adjunto {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  border-radius: 6px;
  padding: 6px 10px;
  background: #25324b;
  color: #bfdbfe;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adjunto:hover {
  background: #334155;
}

.borrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 7px;
  background: #5b21b6;
  color: #fff;
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.borrar:hover {
  background: #7c3aed;
}

.editor {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input-edicion {
  min-width: min(420px, 100%);
  flex: 1;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  padding: 9px 10px;
  background: #111827;
  color: #fff;
  font-size: 20px;
}

.btn-editor {
  border: 0;
  border-radius: 6px;
  padding: 9px 12px;
  background: #334155;
  color: #fff;
  cursor: pointer;
}

.btn-editor.guardar {
  background: #2563eb;
}

.recordatorio-move,
.recordatorio-enter-active,
.recordatorio-leave-active {
  transition: all 0.25s ease;
}

.recordatorio-enter-from,
.recordatorio-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.recordatorio-leave-active {
  position: absolute;
  width: calc(100% - 104px);
}

@keyframes aparecer {
  from {
    opacity: 0;
    transform: translateY(-18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 720px) {
  .pagina-recordatorios {
    padding: 24px 14px;
  }

  .cabecera {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 32px;
  }

  .cabecera h1 {
    font-size: 30px;
  }

  .recordatorio {
    grid-template-columns: 34px minmax(0, 1fr) 40px;
    gap: 12px;
    padding: 14px 12px;
  }

  .texto-recordatorio {
    font-size: 22px;
  }

  .resumen {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
