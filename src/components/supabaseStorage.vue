<script setup>
import { supabase } from '@/supabase';
import { ref } from 'firebase/database';

var file;
var textoRecordatorio = ref("");
var errorEnSubida = false;

async function altaRecordatorio(){
    if(archivo){
        //Antes de escribir en la BD necesito subir el archivo a Supabase
        const {data,error} = await supabase.storage.from('Adjuntos').upload(file.name, file.value)
        if(error){
            console.log("Se ha producido un error: "+error);
            errorEnSubida = true;
        }else{
            console.log("Subido archivo con éxito");    
            errorEnSubida = false;
        }
    }else{
        //Escribir en BD sin archivo
    }

    if(!archivo || !errorEnSubida){
        const {data} = supabase.storage.from('Adjuntos').getPublicUrl(file.name);

        //Alta en firestore
        const docRef = await addDoc(collection(db,"recordatorio"),{
            nombreProd: textoInput.value,
            cantidad: 1,
            comprado: false,
            URL_archivo: data.publicUrl,
            archivo: archivo.name
        });
    }
}

function adjuntarArchivo(e){
    file = e.target.files[0];
    console.log("Archivo seleccionado"+file.name)
}
</script>

<template>
    <form @submit.prevent="altaRecordatorio">
        <label>Texto recordatorio</label>
        <input v-model="textoRecordatorio" type="text">
        <input type="file" @change="adjuntarArchivo">
        <button type="submit">Enviar archivo</button>
        <!--<a v-if="dato.archivo" :href="`${dato.URL_archivo}?download"></a>-->
    </form>
</template>