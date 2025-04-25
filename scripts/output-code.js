const fs = require("fs").promises;
const path = require("path");

// Recibimos la palabra clave desde los argumentos de línea de comandos
const filterWord = process.argv[2];

// Array de rutas excluidas
const excludedPaths = [
  "node_modules",
  ".git",
  "artifacts",
  "cache",
  "scripts",
  "package-lock",
  "yarn.lock",
];

// Array de rutas incluidas (para forzar inclusión)
const includedPaths = [];

// Array para excluir archivos que terminan con cierto sufijo
const excludedFileEndings = [".pdf", ".png", ".old"];

// Nuevo array para excluir archivos que contengan un texto específico en su path
const excludeTextInPath = [];

const isExcluded = (filePath, rootDir) => {
  const relativePath = path.relative(rootDir, filePath);
  return excludedPaths.some((excluded) => relativePath.startsWith(excluded));
};

const isIncluded = (filePath, rootDir) => {
  const relativePath = path.relative(rootDir, filePath);
  return includedPaths.some((included) => relativePath.startsWith(included));
};

// Función para remover comentarios del contenido de un archivo
const removeComments = (content) => {
  // Remover comentarios de una línea de tipo //
  content = content.replace(/\/\/.*/g, "");
  // Remover comentarios multilínea /* ... */
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remover líneas que inician con # (comentarios tipo shell o python)
  content = content.replace(/^[ \t]*#.*/gm, "");
  // Eliminar líneas vacías y líneas que solo contienen espacios en blanco
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
};

// Función auxiliar para verificar si un directorio es padre de alguna ruta incluida
const isParentOfIncluded = (dirPath, rootDir) => {
  return includedPaths.some((included) => {
    // Convertir la ruta incluida a absoluta
    const absIncluded = path.join(rootDir, included);
    // Si la ruta relativa entre dirPath y absIncluded no comienza con '..',
    // significa que dirPath es padre (o coincide) con absIncluded.
    const relative = path.relative(dirPath, absIncluded);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  });
};

async function getAllFiles(dirPath, rootDir, arrayOfFiles = []) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
        // Si el directorio no debe procesarse y no es padre de una ruta forzada, se omite
        if (
          !shouldProcessFile(filePath, rootDir) &&
          !isParentOfIncluded(filePath, rootDir)
        ) {
          continue;
        }
        arrayOfFiles = await getAllFiles(filePath, rootDir, arrayOfFiles);
      } else {
        // Para archivos, si no se debe procesar, se omiten
        if (!shouldProcessFile(filePath, rootDir)) {
          continue;
        }
        arrayOfFiles.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error leyendo directorio: ${dirPath}`, error);
  }

  return arrayOfFiles;
}

const shouldProcessFile = (filePath, rootDir) => {
  // Excluir archivos que terminen con algún sufijo en excludedFileEndings
  if (excludedFileEndings.some((ending) => filePath.endsWith(ending))) {
    return false;
  }

  // Excluir archivos cuyo path contenga alguno de los textos definidos en excludeTextInPath
  if (excludeTextInPath.some((text) => filePath.includes(text))) {
    return false;
  }

  const relativePath = path.relative(rootDir, filePath);

  const matchingExcluded = excludedPaths.filter((excluded) =>
    relativePath.startsWith(excluded)
  );
  const matchingIncluded = includedPaths.filter((included) =>
    relativePath.startsWith(included)
  );

  // Si no coincide con ningún patrón de exclusión, procesamos el archivo
  if (matchingExcluded.length === 0) return true;

  // Si coincide con patrón de exclusión pero no con ninguno de inclusión, se excluye
  if (matchingIncluded.length === 0) return false;

  // Si coincide con ambos, se comparan las longitudes (especificidad)
  const longestExcluded = matchingExcluded.reduce(
    (acc, cur) => (cur.length > acc.length ? cur : acc),
    ""
  );
  const longestIncluded = matchingIncluded.reduce(
    (acc, cur) => (cur.length > acc.length ? cur : acc),
    ""
  );

  // Si el patrón de inclusión es más largo (más específico) que el de exclusión, se procesa
  return longestIncluded.length > longestExcluded.length;
};

// Función principal para procesar los archivos
async function processFiles() {
  try {
    // Obtener el directorio raíz del proyecto
    const rootDir = path.resolve(__dirname, "..");
    // Obtener todos los archivos considerando la inclusión forzada
    let allFiles = await getAllFiles(rootDir, rootDir);

    let outputContent = "";

    // Procesar cada archivo
    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, "utf8");

        // Si se pasó una palabra clave y ésta no se encuentra en el archivo, se omite
        if (filterWord && !content.includes(filterWord)) {
          continue;
        }

        // Procesamos el contenido removiendo comentarios
        const processedContent = removeComments(content);
        // Contamos la cantidad de líneas copiadas
        const lineCount = processedContent.split("\n").length;

        // Agregar el contenido procesado al output
        outputContent += `// File: ${filePath}\n`;
        outputContent += processedContent;
        outputContent += "\n\n/**********/\n\n";
        // Imprimir la cantidad de líneas copiadas junto al mensaje de archivo copiado
        console.log(`${lineCount} l - Archivo: ${filePath}`);
      } catch (err) {
        console.error(`Error procesando archivo ${filePath}:`, err);
      }
    }

    // Guardar el archivo de salida
    const outputPath = path.join(__dirname, "output-code.txt");
    await fs.writeFile(outputPath, outputContent);
    console.log(`Output guardado en: ${outputPath}`);
  } catch (err) {
    console.error("Error procesando archivos:", err);
  }
}

// Ejecutar el script
processFiles();
