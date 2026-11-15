/* Каталог fabbery: всё, что уже выпущено.
   Чтобы добавить модель, скопируй строчку в models и поменяй поля:
     name   — название модели
     text   — одна строка описания (без точки в конце)
     photo  — путь к фото, например 'photos/tiny-ghost-1.jpg'; пока пусто, рисуется призрак
     ghost  — цвет призрака-заглушки, пока нет фото
     bg     — фон карточки: mint, pink, lemon, lilac, sky
     link   — ссылка на модель на MakerWorld
     story  — id истории в мастерской, если она есть (например 'tiny-ghosts')
   Коллекции идут в том порядке, в каком записаны. */
window.CATALOG = {
  collections: [
    {
      name: 'tiny ghosts',
      text: 'Rounded little ghosts with raised arms and kaomoji faces',
      story: 'tiny-ghosts',
      models: [
        { name: 'Tiny ghost 1', text: 'Short description of the model', ghost: '#FBFAFF', bg: 'mint',  link: 'https://makerworld.com/', photo: '' },
        { name: 'Tiny ghost 2', text: 'Short description of the model', ghost: '#D6C8FF', bg: 'lemon', link: 'https://makerworld.com/', photo: '' },
        { name: 'Tiny ghost 3', text: 'Short description of the model', ghost: '#FFE27A', bg: 'sky',   link: 'https://makerworld.com/', photo: '' },
        { name: 'Tiny ghost 4', text: 'Short description of the model', ghost: '#A8E6CF', bg: 'pink',  link: 'https://makerworld.com/', photo: '' }
      ]
    }
  ],
  // что сейчас в работе — показывается последней карточкой и ведёт в мастерскую
  next: { name: 'Halloween little pumpkin', text: 'On the bench in the workshop right now' }
};
