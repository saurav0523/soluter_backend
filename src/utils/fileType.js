import path from 'path';

const FILE_TYPE_MAP = {
  pdf: ['pdf'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'],
  text: ['txt', 'md', 'csv'],
};

export const detectFileType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase().slice(1);

  for (const [type, extensions] of Object.entries(FILE_TYPE_MAP)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }

  return null;
};

