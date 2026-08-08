# Fase 4 · Criterios de aceptación

No se habilita Fase 5 mientras alguno de estos casos falle.

## Automatizados

Ejecutar `npm test` y exigir cero fallas.

1. Cada nivel anual ocupa exactamente dos cuatrimestres del mismo nivel.
2. Naturales contiene 10 laboratorios con cobertura C1–C10.
3. Sociales contiene 12 laboratorios y mantiene la simultaneidad en C6 y C7.
4. Completar laboratorios faltantes no desplaza nombres ni contenidos ya guardados.
5. Los talleres aparecen en la matriz desde el primer ingreso y permiten cambiar C1–C10.
6. Mover contenidos reasigna sin duplicar dentro de la bolsa de origen.
7. Tecnologías y Otros formatos comparten una única bolsa.
8. Un formato anual ocupa siempre C1–C2, C3–C4, C5–C6, C7–C8 o C9–C10.
9. La migración conserva formatos, sinopsis, ubicación temporal y contenidos anteriores.

## Recorrido funcional

1. Abrir `plataforma.html`: deben verse cuatro escuelas y solo Escuela Muestra debe permitir el ingreso.
2. Ingresar con el código del modelo de muestra: la matriz debe cargar sin pantalla en blanco.
3. Seleccionar dos contenidos, moverlos juntos y comprobar que ambos aparecen en el espacio elegido.
4. Mover uno de esos contenidos a otro espacio: debe desaparecer del anterior y aparecer en el nuevo.
5. En celular, repetir el punto anterior sin arrastre, usando **Elegir contenidos** y **Mover**.
6. Cambiar un laboratorio entre Obligatorio y Electivo y verificar que el carácter se conserva al recargar.
7. Crear un Seminario, Proyecto y Ateneo; probar duración cuatrimestral y anual en distintos niveles.
8. Abrir la tabla de control, filtrar pendientes, exportar CSV e imprimir/guardar PDF.
9. Abrir la matriz completa y arrastrar un laboratorio a otro cuatrimestre: debe intercambiarse con el laboratorio de destino sin romper la cobertura ni la simultaneidad C6/C7.
10. Mover un taller y un formato pedagógico tanto por arrastre como mediante el selector móvil; la tarjeta debe aparecer en el nuevo C1–C10.
11. Verificar los cinco niveles, los 10 laboratorios naturales, los 12 sociales y la simultaneidad C6/C7.
12. Editar desde la matriz, guardar, recargar y volver a ingresar desde otro dispositivo; los cambios deben persistir online.

## Límite explícito

La carga horaria, validaciones de horas y cualquier desarrollo posterior pertenecen a Fase 5 y quedan fuera de este cierre.
