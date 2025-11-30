import prisma from '../config/db.js';

const getAllDocs = async (req, res, next) => {
  try {
    const docs = await prisma.document.findMany({
      select: {
        id: true,
        fileName: true,
        fileType: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ documents: docs });
  } catch (error) {
    next(error);
  }
};

const getDocById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
          },
          orderBy: {
            chunkIndex: 'asc',
          },
        },
      },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: doc });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllDocs,
  getDocById,
};

