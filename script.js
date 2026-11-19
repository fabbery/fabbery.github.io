const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const imageModal = document.querySelector('.image-modal');
const modalImage = document.querySelector('.modal-image');
const modalDetails = document.querySelector('.modal-details');
const modalTitle = document.querySelector('#lightbox-title');
const modalDescription = document.querySelector('#lightbox-description');
const modalClose = document.querySelector('.modal-close');
const latestGrid = document.querySelector('#latest-grid');
const catalogGroups = document.querySelector('#catalog-groups');
const modelCount = document.querySelector('.count-value');
let lastImageTrigger = null;
let isClosingPreview = false;

const fallbackModels = Array.from({ length: 12 }, () => ({
  name: 'Model title',
  text: 'Model description',
  photo: '',
}));

function resolvePhoto(photo) {
  if (!photo || typeof photo !== 'string') return '';
  if (/^(?:https?:|data:|\/)/i.test(photo)) return photo;
  return `/${photo.replace(/^\.?\//, '')}`;
}

function appendModelVisual(container, model, compact = false) {
  const photo = resolvePhoto(model.photo);
  container.dataset.title = model.name;
  container.dataset.description = model.text;
  container.setAttribute('aria-label', `Open ${model.name} preview`);

  if (photo) {
    const image = document.createElement('img');
    image.src = photo;
    image.alt = model.name;
    image.loading = 'lazy';
    container.classList.add('has-photo');
    container.append(image);
    return;
  }

  const icon = document.createElement('span');
  icon.className = `showcase-icon${compact ? ' card-icon' : ''}`;
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = 'No image';
  container.append(icon, label);
}

function createLatestCard(model) {
  const card = document.createElement('article');
  card.className = 'featured-card';

  const image = document.createElement('div');
  image.className = 'featured-image';
  image.setAttribute('role', 'img');
  appendModelVisual(image, model, true);

  const title = document.createElement('h3');
  title.textContent = model.name;
  const description = document.createElement('p');
  description.textContent = model.text;
  card.append(image, title, description);
  return card;
}

function createGallerySlot(model) {
  const slot = document.createElement('div');
  slot.className = 'model-slot';
  appendModelVisual(slot, model);
  return slot;
}

function normalizeModels(models) {
  return (Array.isArray(models) ? models : []).map((model) => ({
    name: String(model?.name || 'Model title'),
    text: String(model?.text || 'Model description'),
    photo: typeof model?.photo === 'string' ? model.photo : '',
    released: String(model?.released || ''),
  }));
}

function normalizeCollections(data) {
  if (Array.isArray(data?.collections) && data.collections.length) {
    return data.collections.map((collection, index) => ({
      name: String(collection?.name || `Collection ${index + 1}`),
      models: normalizeModels(collection?.models),
    }));
  }

  if (Array.isArray(data?.models)) {
    return [{ name: 'Featured models', models: normalizeModels(data.models) }];
  }

  return [];
}

function createFallbackCollections(collections) {
  const names = collections.length
    ? collections.map((collection) => collection.name)
    : ['Featured models', 'More models'];
  const fallbackCollections = names.map((name) => ({ name, models: [] }));
  const targetCollections = fallbackCollections.length
    ? fallbackCollections
    : [{ name: 'Featured models', models: [] }];
  const splitSize = Math.ceil(fallbackModels.length / targetCollections.length);

  targetCollections.forEach((collection, index) => {
    collection.models = fallbackModels.slice(index * splitSize, (index + 1) * splitSize);
  });
  return targetCollections;
}

function createCollectionGroup(collection, index) {
  const group = document.createElement('section');
  group.className = 'model-group';

  const heading = document.createElement('h3');
  const headingId = `gallery-group-title-${index + 1}`;
  heading.id = headingId;
  heading.textContent = collection.name;

  const grid = document.createElement('div');
  grid.className = 'model-grid';
  grid.setAttribute('aria-label', collection.name);
  grid.append(...collection.models.map(createGallerySlot));

  group.setAttribute('aria-labelledby', headingId);
  group.append(heading, grid);
  return group;
}

function renderCatalog(data) {
  const catalogCollections = normalizeCollections(data);
  const catalogModels = catalogCollections.flatMap((collection) => collection.models);
  const displayCollections = catalogModels.length
    ? catalogCollections
    : createFallbackCollections(catalogCollections);
  const displayModels = displayCollections.flatMap((collection) => collection.models);

  if (modelCount) modelCount.textContent = String(catalogModels.length);

  const latestModels = [...(catalogModels.length ? catalogModels : fallbackModels)].sort((first, second) => {
    const firstDate = Date.parse(first.released) || 0;
    const secondDate = Date.parse(second.released) || 0;
    return secondDate - firstDate || displayModels.indexOf(first) - displayModels.indexOf(second);
  }).slice(0, 3);
  latestGrid.replaceChildren(...latestModels.map(createLatestCard));
  catalogGroups.replaceChildren(...displayCollections.map(createCollectionGroup));
  prepareImageTriggers();
  updateModelGridColumns();
}

async function loadCatalog() {
  try {
    const response = await fetch('./content/catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const data = await response.json();
    renderCatalog(data);
  } catch {
    renderCatalog({});
  }
}

function setSiteLink(name, value) {
  if (typeof value !== 'string') return;
  const trimmedValue = value.trim();
  if (!/^https?:\/\//i.test(trimmedValue)) return;

  document.querySelectorAll(`[data-site-link="${name}"]`).forEach((link) => {
    link.href = trimmedValue;
  });
}

async function loadSiteLinks() {
  try {
    const response = await fetch('./content/site.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Site links request failed: ${response.status}`);
    const data = await response.json();
    setSiteLink('patreon', data.patreon);
    setSiteLink('pinterest', data.pinterest);
    setSiteLink('instagram', data.instagram);
  } catch {
    // Keep the safe fallback href values from index.html when settings are unavailable.
  }
}

function restoreImageSource() {
  lastImageTrigger?.classList.remove('is-lightbox-source');
  lastImageTrigger?.closest('.featured-card')?.classList.remove('is-lightbox-source');
}

function openImagePreview(source) {
  if (!imageModal.hidden || isClosingPreview) return;
  lastImageTrigger = source;
  const sourceRect = source.getBoundingClientRect();
  const card = source.closest('.featured-card');
  const title = source.dataset.title || card?.querySelector('h3')?.textContent || 'Model title';
  const description = source.dataset.description || card?.querySelector('p')?.textContent || 'Model description';
  const sourceImage = source.querySelector('img');
  const sourceTitle = card?.querySelector('h3');
  const sourceDescription = card?.querySelector('p');
  const sourceTextRect = sourceTitle && sourceDescription
    ? getUnionRect(sourceTitle.getBoundingClientRect(), sourceDescription.getBoundingClientRect())
    : sourceRect;

  source.classList.add('is-lightbox-source');
  card?.classList.add('is-lightbox-source');

  modalTitle.textContent = title;
  modalDescription.textContent = description;
  modalImage.replaceChildren();
  modalImage.classList.remove('is-opening');
  modalDetails.classList.remove('is-opening', 'is-closing');
  modalImage.style.visibility = 'hidden';
  modalDetails.style.visibility = 'hidden';

  if (sourceImage) {
    const image = sourceImage.cloneNode(true);
    image.removeAttribute('loading');
    modalImage.append(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'modal-placeholder';
    placeholder.innerHTML = '<span class="showcase-icon" aria-hidden="true"></span><span>No image</span>';
    modalImage.append(placeholder);
  }

  imageModal.hidden = false;
  document.body.classList.add('modal-open');
  const targetRect = modalImage.getBoundingClientRect();
  const targetTextRect = modalDetails.getBoundingClientRect();
  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const startScale = Math.max(.08, Math.min(1, sourceRect.width / targetRect.width));
  const textFromX = sourceTextRect.left + sourceTextRect.width / 2 - (targetTextRect.left + targetTextRect.width / 2);
  const textFromY = sourceTextRect.top + sourceTextRect.height / 2 - (targetTextRect.top + targetTextRect.height / 2);
  const textStartScale = Math.max(.16, Math.min(1, sourceTextRect.width / targetTextRect.width));
  modalImage.style.setProperty('--from-x', `${sourceCenterX - targetCenterX}px`);
  modalImage.style.setProperty('--from-y', `${sourceCenterY - targetCenterY}px`);
  modalImage.style.setProperty('--from-scale', startScale);
  modalDetails.style.setProperty('--text-from-x', `${textFromX}px`);
  modalDetails.style.setProperty('--text-from-y', `${textFromY}px`);
  modalDetails.style.setProperty('--text-from-scale', textStartScale);
  modalImage.classList.add('is-opening');
  modalDetails.classList.add('is-opening');
  requestAnimationFrame(() => {
    modalImage.style.visibility = '';
    modalDetails.style.visibility = '';
  });
  modalClose.focus();
}

function getUnionRect(firstRect, secondRect) {
  const left = Math.min(firstRect.left, secondRect.left);
  const top = Math.min(firstRect.top, secondRect.top);
  const right = Math.max(firstRect.right, secondRect.right);
  const bottom = Math.max(firstRect.bottom, secondRect.bottom);
  return { left, top, width: right - left, height: bottom - top };
}

function closeImagePreview() {
  if (imageModal.hidden || isClosingPreview) return;

  if (reduceMotion.matches || !lastImageTrigger) {
    restoreImageSource();
    imageModal.hidden = true;
    document.body.classList.remove('modal-open');
    modalImage.classList.remove('is-opening', 'is-closing');
    modalDetails.classList.remove('is-opening', 'is-closing');
    modalImage.style.visibility = '';
    modalDetails.style.visibility = '';
    lastImageTrigger?.focus();
    return;
  }

  const sourceRect = lastImageTrigger.getBoundingClientRect();
  const targetRect = modalImage.getBoundingClientRect();
  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const endScale = Math.max(.08, Math.min(1, sourceRect.width / targetRect.width));
  const sourceTitle = lastImageTrigger.closest('.featured-card')?.querySelector('h3');
  const sourceDescription = lastImageTrigger.closest('.featured-card')?.querySelector('p');
  const sourceTextRect = sourceTitle && sourceDescription
    ? getUnionRect(sourceTitle.getBoundingClientRect(), sourceDescription.getBoundingClientRect())
    : sourceRect;
  const detailRect = modalDetails.getBoundingClientRect();
  const textToX = sourceTextRect.left + sourceTextRect.width / 2 - (detailRect.left + detailRect.width / 2);
  const textToY = sourceTextRect.top + sourceTextRect.height / 2 - (detailRect.top + detailRect.height / 2);
  const textEndScale = Math.max(.16, Math.min(1, sourceTextRect.width / detailRect.width));

  modalImage.style.setProperty('--to-x', `${sourceCenterX - targetCenterX}px`);
  modalImage.style.setProperty('--to-y', `${sourceCenterY - targetCenterY}px`);
  modalImage.style.setProperty('--to-scale', endScale);
  modalDetails.style.setProperty('--text-to-x', `${textToX}px`);
  modalDetails.style.setProperty('--text-to-y', `${textToY}px`);
  modalDetails.style.setProperty('--text-to-scale', textEndScale);
  modalImage.classList.remove('is-opening');
  modalDetails.classList.remove('is-opening');
  void modalImage.offsetWidth;
  void modalDetails.offsetWidth;
  modalImage.classList.add('is-closing');
  modalDetails.classList.add('is-closing');
  imageModal.classList.add('is-closing');
  isClosingPreview = true;

  window.setTimeout(restoreImageSource, 320);

  window.setTimeout(() => {
    restoreImageSource();
    imageModal.hidden = true;
    imageModal.classList.remove('is-closing');
    document.body.classList.remove('modal-open');
    modalImage.classList.remove('is-closing');
    modalDetails.classList.remove('is-closing');
    modalImage.style.visibility = '';
    modalDetails.style.visibility = '';
    lastImageTrigger?.focus();
    isClosingPreview = false;
  }, 460);
}

function prepareImageTrigger(source) {
  if (source.dataset.lightboxReady) return;
  source.dataset.lightboxReady = 'true';
  source.tabIndex = 0;
  source.setAttribute('role', 'button');
  source.setAttribute('aria-haspopup', 'dialog');
  if (!source.getAttribute('aria-label')) source.setAttribute('aria-label', 'Open model preview');
}

function prepareImageTriggers(root = document) {
  if (root instanceof Element && root.matches('.featured-image, .model-slot')) prepareImageTrigger(root);
  root.querySelectorAll?.('.featured-image, .model-slot').forEach(prepareImageTrigger);
}

prepareImageTriggers();
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const source = event.target.closest('.featured-image, .model-slot');
  if (source) openImagePreview(source);
});
document.addEventListener('keydown', (event) => {
  if (!(event.target instanceof Element)) return;
  const source = event.target.closest('.featured-image, .model-slot');
  if (!source || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  openImagePreview(source);
});

modalClose.addEventListener('click', closeImagePreview);
imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal || event.target.matches('[data-lightbox-close]')) closeImagePreview();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !imageModal.hidden) closeImagePreview();
});
window.addEventListener('resize', () => {
  updateModelGridColumns();
});

function updateModelGridColumns() {
  document.querySelectorAll('.model-grid').forEach((grid) => {
    const availableWidth = grid.parentElement.clientWidth;
    const itemCount = grid.children.length;
    const columns = Math.max(1, Math.min(itemCount, Math.floor(availableWidth / 120)));
    grid.style.setProperty('--grid-columns', columns);
  });
}

updateModelGridColumns();

const homePage = document.querySelector('.home-page');
if (homePage && 'MutationObserver' in window) {
  const contentObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareImageTriggers(node);
      });
    });
    updateModelGridColumns();
  });
  contentObserver.observe(homePage, { childList: true, subtree: true });
}

renderCatalog({});
loadCatalog();
loadSiteLinks();

let scrollTarget = window.scrollY;
let scrollFrame = null;

function animateScroll() {
  const currentScroll = window.scrollY;
  const distance = scrollTarget - currentScroll;

  if (Math.abs(distance) < 0.5) {
    window.scrollTo({ top: scrollTarget, left: 0, behavior: 'auto' });
    scrollFrame = null;
    return;
  }

  window.scrollTo({ top: currentScroll + distance * 0.1, left: 0, behavior: 'auto' });
  scrollFrame = requestAnimationFrame(animateScroll);
}

function smoothWheelScroll(event) {
  if (document.body.classList.contains('modal-open') || reduceMotion.matches || event.ctrlKey || event.metaKey) return;

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;

  event.preventDefault();
  scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget + event.deltaY * 0.85));

  if (!scrollFrame) scrollFrame = requestAnimationFrame(animateScroll);
}

window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollTarget = window.scrollY;
});
window.addEventListener('wheel', smoothWheelScroll, { passive: false });
