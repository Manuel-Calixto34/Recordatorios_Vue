<script setup>
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GithubAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const auth = getAuth()
const router = useRouter()
const provider = new GoogleAuthProvider();
const gitHubProvider = new GithubAuthProvider();

let admin = "admin@gmail.com";
const nombreUsuario = ref('')
const imgUsuario = ref('')
const email = ref('')
const esAdmin = ref(false);
const logueado = ref(false)
const password = ref('')

onAuthStateChanged(auth, (user) => {
  if (user) {
    logueado.value = true
    nombreUsuario.value = user.displayName || user.email || 'Usuario'
    imgUsuario.value = user.photoURL || ''
    if(user.email == admin){
      esAdmin.value = true;
    }

  } else {
    logueado.value = false
    nombreUsuario.value = ''
    imgUsuario.value = ''
  }
})

function registro() {
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then(() => {
      router.push({ name: 'recordatorios' })
    })
    .catch((error) => {
      console.error('No se pudo registrar el usuario', error)
    })
}

function iniciaSesionEmailPassword() {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(() => {
      router.push({ name: 'recordatorios' })
    })
    .catch((error) => {
      console.error('No se pudo iniciar sesion', error)
    })
}

function iniciaSesionGoogle() {
  signInWithPopup(auth, provider)
    .then(() => {
      router.push({ name: 'recordatorios' })
    })
    .catch((error) => {
      console.error('No se pudo iniciar sesion con Google', error)
    })
}

function iniciaSesionGithub() {
  try {
    signInWithPopup(auth, gitHubProvider).then(() =>
    router.push({ name: 'recordatorios' }))
  }catch (error) {
    console.error('No se pudo iniciar sesion con GitHub', {
      code: error.code,
      message: error.message,
      email: error.customData?.email || null,
      credential: GithubAuthProvider.credentialFromError(error)
    })
  }
}
</script>

<template>
  <main class="landing">
    <section class="panel-login">
      <div class="presentacion">
        <h1>Bienvenid@ a Recordatorios</h1>
        <p class="descripcion">
          Organiza tus tareas pendientes, cambia prioridades y guarda tus recordatorios
          en el navegador.
        </p>
      </div>

      <div class="zona-acceso">
        <form class="formulario-login">
          <h2>Accede a tu cuenta</h2>

          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="input-texto"
            type="email"
            placeholder="tu@email.com"
          >

          <label for="password">Contrase&ntilde;a</label>
          <input
            id="password"
            v-model="password"
            class="input-texto"
            type="password"
            placeholder="Password"
            @keyup.enter="iniciaSesionEmailPassword"
          >

          <div class="acciones">
            <button type="button" class="btn btn-principal" @click="iniciaSesionEmailPassword">
              Iniciar sesión
            </button>
            <button type="button" class="btn" @click="registro">
              Crear cuenta
            </button>
          </div>

          <a class="enlace-recuperar" href="#">¿Has olvidado tu contraseña?</a>
        </form>

        <button class="btn-google" type="button" @click="iniciaSesionGoogle">
          Iniciar sesión con Google
        </button>
        <button class="btn-github" type="button" @click="iniciaSesionGithub">
          Iniciar sesión con GitHub
        </button>
      </div>
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

.landing {
  display: grid;
  min-height: calc(100vh - 52px);
  padding: 52px;
  box-sizing: border-box;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.2), transparent 34%),
    linear-gradient(30deg, rgba(124, 58, 237, 0.18), transparent 32%),
    #111827;
}

.panel-login {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(320px, 440px);
  gap: 42px;
  width: min(100%, 980px);
  padding: 38px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #172033;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.44);
}

.presentacion {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.etiqueta {
  margin: 0 0 16px;
  color: #7dd3fc;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #f8fbff;
  font-size: 42px;
  font-weight: 400;
  line-height: 1.12;
}

.descripcion {
  max-width: 470px;
  margin: 20px 0 0;
  color: #b9c9e6;
  font-size: 17px;
  line-height: 1.6;
}

.zona-acceso {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.formulario-login {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px;
  border: 1px solid #334155;
  border-radius: 5px;
  background: #111827;
}

h2 {
  margin: 0 0 14px;
  color: #eef6ff;
  font-size: 24px;
  font-weight: 400;
}

label {
  color: #c7d2fe;
  font-size: 13px;
  font-weight: 700;
}

.input-texto {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #3b82f6;
  border-radius: 5px;
  margin-bottom: 10px;
  padding: 14px 16px;
  background: #eff6ff;
  color: #172033;
  font-size: 16px;
  outline: none;
}

.input-texto:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}

.acciones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.btn,
.btn-google,.btn-github {
  min-height: 44px;
  border: 0;
  border-radius: 5px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.btn {
  background: #334155;
  color: #fff;
}

.btn-principal {
  background: #2563eb;
}

.btn:hover,
.btn-google:hover,.btn-github:hover {
  transform: translateY(-1px);
}

.btn:hover {
  background: #475569;
}

.btn-principal:hover {
  background: #38bdf8;
  color: #082f49;
}

.enlace-recuperar {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 8px;
  color: #93c5fd;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.enlace-recuperar:hover {
  text-decoration: underline;
}

.btn-google {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #eff6ff;
  color: #172033;
}

.btn-google span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef4f45;
  color: #fff;
  font-weight: 700;
}

.btn-google:hover {
  background: #dbeafe;
}

.btn-github {
  background: #4c1d95;
  color: #fff;
}

.btn-github:hover {
  background: #6d28d9;
}

@media (max-width: 820px) {
  .landing {
    min-height: auto;
    padding: 28px 18px;
    place-items: stretch;
  }

  .panel-login {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 24px;
  }

  h1 {
    font-size: 34px;
  }

  .formulario-login {
    padding: 22px;
  }
}

@media (max-width: 480px) {
  .acciones {
    grid-template-columns: 1fr;
  }
}
</style>
