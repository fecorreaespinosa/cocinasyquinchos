#!/usr/bin/env node
/**
 * Sincroniza las carpetas "Proyecto - <nombre>" de la raíz del sitio con:
 *   - images/proyectos/<slug>/  (fotos copiadas y renombradas)
 *   - proyecto-<slug>.html      (página de galería del proyecto)
 *   - index.html                (grilla "Proyectos recientes", entre los
 *                                 marcadores AUTO-GALLERY:START/END)
 *
 * Uso:  node scripts/sync-proyectos.js
 *
 * Cómo se detecta cada proyecto:
 *   - Cualquier carpeta de la raíz que empiece con "Proyecto - ".
 *   - Las fotos sueltas dentro de esa carpeta son la galería principal,
 *     ordenadas alfabéticamente (la primera es la foto de portada).
 *     Para forzar el orden, prefija los archivos con 1_, 2_, etc.
 *   - Las subcarpetas cuyo nombre contiene "antes" (sin importar mayúsculas)
 *     se agregan al final de la galería con una etiqueta "Antes".
 *   - Cualquier otra subcarpeta se ignora y se avisa por consola —
 *     probablemente sea un proyecto aparte que necesita su propia carpeta
 *     "Proyecto - ...".
 *   - El tag (Quincho/Cocina) se detecta buscando esas palabras en el
 *     nombre de la carpeta o de las fotos.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const WA_PHONE = '56994975216';

const WA_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.524 5.847L.057 23.998l6.304-1.452A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.939 0-3.762-.516-5.337-1.419l-.382-.228-3.962.911.959-3.853-.25-.396A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>';

function slugify(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Cuando el nombre de la carpeta y sus fotos no dicen "quincho" ni "cocina"
// (ej. "Proyecto - El Habito"), no hay forma de adivinar el tag — se
// declara acá a mano. Agrega una línea si creas una carpeta nueva así.
const TAG_OVERRIDES = {
  'El Habito': 'Cocina',
  'Malmo': 'Cocina',
  'Viñas de Chicureo': 'Quincho',
};

function detectTag(folderName, fileNames) {
  if (TAG_OVERRIDES[folderName]) return TAG_OVERRIDES[folderName];
  const text = (folderName + ' ' + fileNames.join(' ')).toLowerCase();
  if (/quincho/.test(text)) return 'Quincho';
  if (/cocina/.test(text)) return 'Cocina';
  return 'Proyecto';
}

function buildTitle(folderName, tag) {
  if (tag !== 'Proyecto' && new RegExp(tag, 'i').test(folderName)) return folderName;
  return `${tag} ${folderName}`;
}

function waLink(title) {
  const text = `Hola, me interesa un proyecto como ${title}`;
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
}

function discoverProjects() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('Proyecto - '));

  const projects = [];
  for (const entry of entries) {
    const folderName = entry.name.replace(/^Proyecto - /, '').trim();
    const folderPath = path.join(ROOT, entry.name);
    const children = fs.readdirSync(folderPath, { withFileTypes: true });

    const topFiles = children
      .filter(c => c.isFile() && IMAGE_EXT.test(c.name))
      .map(c => c.name)
      .sort((a, b) => a.localeCompare(b, 'es'));

    const antesFiles = [];
    const skippedSubfolders = [];
    for (const child of children.filter(c => c.isDirectory())) {
      if (/antes/i.test(child.name)) {
        const sub = fs.readdirSync(path.join(folderPath, child.name), { withFileTypes: true })
          .filter(c => c.isFile() && IMAGE_EXT.test(c.name))
          .map(c => c.name)
          .sort((a, b) => a.localeCompare(b, 'es'));
        for (const f of sub) antesFiles.push(path.join(child.name, f));
      } else {
        skippedSubfolders.push(child.name);
      }
    }

    if (topFiles.length === 0 && antesFiles.length === 0) {
      console.warn(`⚠️  "${entry.name}" no tiene fotos, se omite.`);
      continue;
    }

    const tag = detectTag(folderName, topFiles);
    const title = buildTitle(folderName, tag);
    const slug = slugify(folderName);

    projects.push({ folderName, folderPath, slug, title, tag, topFiles, antesFiles, skippedSubfolders });
  }
  return projects.sort((a, b) => a.slug.localeCompare(b.slug));
}

function syncPhotos(project) {
  const destDir = path.join(ROOT, 'images', 'proyectos', project.slug);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const files = [
    ...project.topFiles.map(f => ({ src: path.join(project.folderPath, f), antes: false })),
    ...project.antesFiles.map(f => ({ src: path.join(project.folderPath, f), antes: true })),
  ];

  const photos = [];
  files.forEach((f, i) => {
    const ext = path.extname(f.src).toLowerCase();
    const destName = `${i + 1}${ext}`;
    fs.copyFileSync(f.src, path.join(destDir, destName));
    photos.push({ file: destName, antes: f.antes });
  });
  return photos;
}

function renderProjectPage(project, photos) {
  const wa = waLink(project.title);
  const grid = photos.map((p, i) => {
    const cls = p.antes ? 'proyecto-ph antes' : 'proyecto-ph';
    return `      <div class="${cls}"><img src="images/proyectos/${project.slug}/${p.file}" alt="${project.title} — foto ${i + 1}" loading="lazy"></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title} — Quinchos &amp; Cocinas</title>
  <meta name="description" content="${project.title}: fotos del proyecto realizado por Quinchos &amp; Cocinas en Santiago.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/site.css">
</head>
<body>

  <!-- ── NAV ── -->
  <nav class="nav" aria-label="Navegación principal">
    <a href="index.html" class="nav-logo">Quinchos<span>&amp;</span>Cocinas</a>
    <ul class="nav-links">
      <li><a href="index.html#quinchos">Quinchos</a></li>
      <li><a href="index.html#cocinas">Cocinas</a></li>
      <li><a href="index.html#portafolio">Portafolio</a></li>
      <li><a href="index.html#nosotros">Nosotros</a></li>
    </ul>
    <a href="/cotizador" class="nav-cta" style="margin-right:8px; background:transparent; border:1px solid rgba(200,184,154,0.3); color:var(--sand);">
      Cotizador
    </a>
    <a href="${wa}" class="nav-cta" target="_blank" rel="noopener">
      ${WA_ICON}
      Cotizar
    </a>
    <button class="nav-hamburger" aria-label="Menú">
      <span></span><span></span><span></span>
    </button>
  </nav>

  <p class="breadcrumb"><a href="index.html">Inicio</a> &nbsp;/&nbsp; <a href="index.html#portafolio">Portafolio</a> &nbsp;/&nbsp; ${project.title}</p>

  <section class="proyecto-hero" aria-label="${project.title}">
    <div>
      <span class="gal-info-tag">${project.tag}</span>
      <h1 class="proyecto-title">${project.title}</h1>
    </div>
    <a href="${wa}" class="btn-primary" target="_blank" rel="noopener">
      ${WA_ICON}
      Cotizar un proyecto así
    </a>
  </section>

  <section class="proyecto-photos" aria-label="Fotos del proyecto ${project.title}">
    <div class="proyecto-grid" id="proyectoGrid">
${grid}
    </div>
  </section>

  <!-- ── CTA FINAL ── -->
  <section class="cta-section">
    <div>
      <h2 class="cta-title">¿Quieres un proyecto así?</h2>
      <p class="cta-sub">Conversemos por WhatsApp y te ayudamos a diseñarlo a tu medida, con el mismo equipo de principio a fin.</p>
    </div>
    <div class="cta-btns">
      <a href="${wa}" class="btn-white" target="_blank" rel="noopener">
        Cotizar por WhatsApp
      </a>
      <a href="index.html#portafolio" class="btn-outline-white">Ver más proyectos</a>
    </div>
  </section>

  <!-- ── FOOTER ── -->
  <footer class="footer" id="nosotros">
    <div class="footer-top">
      <div>
        <a href="index.html" class="footer-logo">Quinchos<span>&amp;</span>Cocinas</a>
        <p class="footer-tagline">Diseño, fabricación e instalación a medida.<br>Santiago, Chile.</p>
      </div>

      <div class="footer-nav">
        <div class="footer-nav-col">
          <h4>Servicios</h4>
          <ul>
            <li><a href="index.html#quinchos">Quinchos</a></li>
            <li><a href="index.html#cocinas">Cocinas</a></li>
            <li><a href="index.html#portafolio">Portafolio</a></li>
          </ul>
        </div>
        <div class="footer-nav-col">
          <h4>Comunas</h4>
          <ul>
            <li><a href="index.html">Las Condes</a></li>
            <li><a href="index.html">Vitacura</a></li>
            <li><a href="index.html">Lo Barnechea</a></li>
            <li><a href="index.html">La Reina</a></li>
            <li><a href="index.html">Peñalolén</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-contact">
        <p class="footer-contact-label">Contáctanos</p>
        <a href="https://wa.me/${WA_PHONE}" class="footer-contact-wa" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.524 5.847L.057 23.998l6.304-1.452A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.939 0-3.762-.516-5.337-1.419l-.382-.228-3.962.911.959-3.853-.25-.396A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          +56 9 9497 5216
        </a>
      </div>
    </div>

    <div class="footer-bottom">
      <p class="footer-copy">© 2024 Quinchos &amp; Cocinas. Todos los derechos reservados.</p>
      <p class="footer-comunas">Las Condes · Vitacura · Lo Barnechea · La Reina · Peñalolén</p>
    </div>
  </footer>

  <!-- ── WA FLOAT ── -->
  <a href="${wa}" class="wa-float" target="_blank" rel="noopener" aria-label="Contactar por WhatsApp">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.524 5.847L.057 23.998l6.304-1.452A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.939 0-3.762-.516-5.337-1.419l-.382-.228-3.962.911.959-3.853-.25-.396A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
    <span>Cotizar por WhatsApp</span>
    <span class="wa-float-dot"></span>
  </a>

  <!-- ── LIGHTBOX ── -->
  <div class="lightbox" id="lightbox">
    <button class="lightbox-close" id="lbClose" aria-label="Cerrar">✕</button>
    <button class="lightbox-prev" id="lbPrev" aria-label="Foto anterior">‹</button>
    <img id="lbImg" src="" alt="">
    <button class="lightbox-next" id="lbNext" aria-label="Foto siguiente">›</button>
    <div class="lightbox-count" id="lbCount"></div>
  </div>

  <script>
    const photos = Array.from(document.querySelectorAll('#proyectoGrid img'));
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lbImg');
    const lbCount = document.getElementById('lbCount');
    let current = 0;

    function openAt(i) {
      current = i;
      lbImg.src = photos[current].src;
      lbImg.alt = photos[current].alt;
      lbCount.textContent = (current + 1) + ' / ' + photos.length;
      lightbox.classList.add('open');
    }
    function close() { lightbox.classList.remove('open'); }
    function next() { openAt((current + 1) % photos.length); }
    function prev() { openAt((current - 1 + photos.length) % photos.length); }

    photos.forEach((img, i) => img.parentElement.addEventListener('click', () => openAt(i)));
    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbNext').addEventListener('click', next);
    document.getElementById('lbPrev').addEventListener('click', prev);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });
  </script>
</body>
</html>
`;
}

function renderGalleryItem(project, coverPhoto) {
  return `      <a class="gal-item" href="proyecto-${project.slug}.html">
        <div class="gal-ph" style="height:100%;">
          <img src="images/proyectos/${project.slug}/${coverPhoto}" alt="${project.title}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
        </div>
        <div class="gal-overlay">
          <div>
            <div class="gal-info-label">${project.folderName}</div>
            <div class="gal-info-tag">${project.tag}</div>
          </div>
        </div>
      </a>`;
}

function updateIndexGallery(projects, coverByProject) {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const start = '<!-- AUTO-GALLERY:START (generado por scripts/sync-proyectos.js, no editar a mano) -->';
  const end = '<!-- AUTO-GALLERY:END -->';
  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    console.error('⚠️  No encontré los marcadores AUTO-GALLERY en index.html — no actualicé la grilla.');
    return;
  }

  const items = projects.map(p => renderGalleryItem(p, coverByProject[p.slug])).join('\n\n');
  const before = html.slice(0, startIdx + start.length);
  const after = html.slice(endIdx);
  html = `${before}\n${items}\n      ${after}`;
  fs.writeFileSync(indexPath, html);
}

function cleanStale(currentSlugs) {
  const proyectosDir = path.join(ROOT, 'images', 'proyectos');
  if (fs.existsSync(proyectosDir)) {
    for (const d of fs.readdirSync(proyectosDir)) {
      if (!currentSlugs.has(d)) {
        fs.rmSync(path.join(proyectosDir, d), { recursive: true, force: true });
        console.log(`🗑️  Borrado images/proyectos/${d} (ya no existe esa carpeta de proyecto).`);
      }
    }
  }
  for (const f of fs.readdirSync(ROOT)) {
    const m = f.match(/^proyecto-(.+)\.html$/);
    if (m && !currentSlugs.has(m[1])) {
      fs.rmSync(path.join(ROOT, f));
      console.log(`🗑️  Borrado ${f} (ya no existe esa carpeta de proyecto).`);
    }
  }
}

function main() {
  const projects = discoverProjects();
  if (projects.length === 0) {
    console.error('No se encontró ninguna carpeta "Proyecto - ...".');
    process.exit(1);
  }

  cleanStale(new Set(projects.map(p => p.slug)));

  const coverByProject = {};
  for (const project of projects) {
    const photos = syncPhotos(project);
    coverByProject[project.slug] = photos[0].file;
    fs.writeFileSync(path.join(ROOT, `proyecto-${project.slug}.html`), renderProjectPage(project, photos));

    console.log(`✅ ${project.title}  [${project.tag}]  → proyecto-${project.slug}.html  (${photos.length} fotos${photos.some(p => p.antes) ? ', ' + photos.filter(p => p.antes).length + ' marcadas Antes' : ''})`);
    if (project.skippedSubfolders.length) {
      console.log(`   ⚠️  Subcarpetas ignoradas (no contienen "antes" en el nombre): ${project.skippedSubfolders.join(', ')}`);
    }
  }

  updateIndexGallery(projects, coverByProject);
  console.log(`\nListo. index.html actualizado con ${projects.length} proyectos.`);
}

main();
