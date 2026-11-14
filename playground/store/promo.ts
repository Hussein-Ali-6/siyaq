import iconUrl from '../../public/icon/128.png';

for (const img of document.querySelectorAll<HTMLImageElement>('img[data-icon]')) img.src = iconUrl;
document.body.className = location.hash === '#icon' ? 'show-icon' : 'show-tile';
