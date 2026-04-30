import { createApp } from 'vue'
import App from './App.vue'
import { VueFire } from 'vuefire'
import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence } from "firebase/auth";
import { createWebHistory,createRouter } from 'vue-router';
import LandingPage from './components/LandingPage.vue';
import Recordatorios from './components/Recordatorios.vue';
import Administracion from './components/Administracion.vue';

const firebaseConfig = {
  apiKey: "AIzaSyD7kTWHcGRdux8qlh-W--lXqJYBP4ezWs8",
  authDomain: "recordatoriosvue-a7fb5.firebaseapp.com",
  projectId: "recordatoriosvue-a7fb5",
  storageBucket: "recordatoriosvue-a7fb5.firebasestorage.app",
  messagingSenderId: "814013942800",
  appId: "1:814013942800:web:1f2fb7b93f0064aa940e95"
};

const firebaseApp = initializeApp(firebaseConfig);

const app = createApp(App);

const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('No se pudo mantener la persistencia de sesion', error)
})

const admin = 'admin@gmail.com';
let usuarioActual = null;
let authInicializado = false;
let resolverAuthInicializado;

const esperarAuthInicializado = new Promise((resolve) => {
  resolverAuthInicializado = resolve
})

onAuthStateChanged(auth, (user) => {
  usuarioActual = user

  if (!authInicializado) {
    authInicializado = true
    resolverAuthInicializado(user)
  }
})

function esUsuarioAdmin(user) {
  return user?.email === admin
}

const routes = [
  {path: '/', component: LandingPage,name: "landing", meta: {requiresAuth: false}},
  {path: '/recordatorios', component: Recordatorios, name: "recordatorios", meta: {requiresAuth: true}},
  {path: '/administracion', component: Administracion,name: "administracion", meta: {requiresAuth: true, requiresAdmin: true}}
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  await esperarAuthInicializado

  const user = auth.currentUser || usuarioActual

  if (to.name === 'landing' && user) {
    return { name: 'recordatorios' }
  }

  if (!to.meta.requiresAuth && !to.meta.requiresAdmin) {
    return true
  }

  if (to.meta.requiresAuth && !user) {
    return { name: 'landing' }
  }

  if (to.meta.requiresAdmin && !esUsuarioAdmin(user)) {
    return { name: 'recordatorios' }
  }

  return true
})


app.use ( VueFire, {
    firebaseApp,
    modules: [],
});

app.use(router);

app.mount('#app')
