<script setup>
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc
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
const esAdmin = ref(false)
const textoEditado = ref('')
const usuarioActual = ref(null)
let cancelarLecturaRecordatorios = null

onAuthStateChanged(auth, (user) => {
  esAdmin.value = user?.email === admin
  usuarioActual.value = user

  if (esAdmin.value) {
    if (!cancelarLecturaRecordatorios) {
      const consulta = query(coleccionRecordatorios)

      cancelarLecturaRecordatorios = onSnapshot(consulta, (snapshot) => {
        recordatorios.value = snapshot.docs.map((recordatorio) => normalizarRecordatorio(recordatorio))
        ordenarRecordatorios()
      }, (error) => {
        console.error('No se pudieron leer los recordatorios', error)
      })
    }
  } else {
    if (cancelarLecturaRecordatorios) {
      cancelarLecturaRecordatorios()
      cancelarLecturaRecordatorios = null
    }

    recordatorios.value = []
  }
})

function normalizarRecordatorio(recordatorio) {
  const datos = recordatorio.data()

  return {
    id: recordatorio.id,
    texto: datos.texto || '',
    prioridad: prioridades.includes(datos.prioridad) ? datos.prioridad : 'Normal',
    creadoEn: Number(datos.creadoEn) || Date.now(),
    completado: Boolean(datos.completado),
    usuarioId: datos.usuarioId || '',
    usuarioEmail: datos.usuarioEmail || '',
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

async function anadirRecordatorio() {
  const textoLimpio = texto.value.trim()

  if (textoLimpio && usuarioActual.value) {
    const nuevoRecordatorio = {
      texto: textoLimpio,
      prioridad: 'Normal',
      creadoEn: Date.now(),
      completado: false,
      usuarioId: usuarioActual.value.uid,
      usuarioEmail: usuarioActual.value.email || ''
    }

    try {
      await addDoc(coleccionRecordatorios, nuevoRecordatorio)
      texto.value = ''
    } catch (error) {
      console.error('No se pudo crear el recordatorio', error)
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
    await deleteDoc(doc(db, 'recordatorios', id))
  } catch (error) {
    console.error('No se pudo borrar el recordatorio', error)
  }
}

async function borrarCompletados() {
  const completados = recordatorios.value.filter((recordatorio) => recordatorio.completado)

  try {
    await Promise.all(
      completados.map((recordatorio) => deleteDoc(doc(db, 'recordatorios', recordatorio.id)))
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

function volverRecordatorios(){
  router.push({name: "recordatorios"});
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
      <div>
        <p class="etiqueta">Panel de administración</p>
        <h1>Todos los recordatorios</h1>
      </div>

      <div class="acciones-cabecera">
        <button class="btn-sesion volver" type="button" @click="volverRecordatorios">
          Volver a mis recordatorios
        </button>
        <button class="btn-sesion salir" type="button" @click="cerrarSesion">
          Cerrar sesion
        </button>
      </div>
    </header>

    <section class="contenedor">
      <input
        v-model="texto"
        class="input-principal"
        type="text"
        placeholder="Qué quieres recordar?"
        @keyup.enter="anadirRecordatorio"
      />

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
              <span class="usuario">
                {{ recordatorio.usuarioEmail || 'Usuario sin email' }}
              </span>
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
  padding: 38px 22px;
  box-sizing: border-box;
  background:
    linear-gradient(140deg, rgba(56, 189, 248, 0.2), transparent 30%),
    linear-gradient(20deg, rgba(124, 58, 237, 0.18), transparent 28%),
    #111827;
}

.cabecera {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  width: min(100%, 1100px);
  margin: 0 auto 24px;
}

.etiqueta {
  margin: 0 0 8px;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.cabecera h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.15;
}

.acciones-cabecera {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.btn-sesion {
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 11px 15px;
  background: #1e293b;
  color: #eef6ff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.btn-sesion:hover {
  border-color: #60a5fa;
  background: #27364f;
  transform: translateY(-1px);
}

.contenedor {
  width: min(100%, 1100px);
  margin: 0 auto;
  padding: 22px;
  box-sizing: border-box;
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.94);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.44);
}

.input-principal {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #3b82f6;
  border-radius: 7px;
  padding: 16px 18px;
  background: #eff6ff;
  color: #172033;
  font-size: 17px;
  outline: none;
}

.input-principal:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}

.input-principal::placeholder {
  color: #9da3aa;
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
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 16px;
  min-height: 78px;
  padding: 15px 16px;
  border: 1px solid #334155;
  border-left: 4px solid #38bdf8;
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
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
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
  gap: 7px;
  margin-top: 10px;
  color: #a8b8d8;
  font-size: 13px;
}

.usuario {
  max-width: 240px;
  overflow: hidden;
  border: 1px solid #334155;
  border-radius: 999px;
  padding: 4px 9px;
  color: #dbeafe;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  margin-left: 4px;
}

.borrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 7px;
  background: #5b21b6;
  color: #fff;
  font-size: 30px;
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
  font-size: 18px;
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

@media (max-width: 760px) {
  .pagina-recordatorios {
    padding: 24px 14px;
  }

  .cabecera {
    align-items: flex-start;
    flex-direction: column;
  }

  .acciones-cabecera {
    justify-content: flex-start;
  }

  .recordatorio {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .estado,
  .borrar {
    justify-self: start;
  }

  .resumen {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
