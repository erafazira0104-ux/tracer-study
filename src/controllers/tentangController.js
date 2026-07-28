const getTentangPage = (req, res) => {
  try {
    res.render('tentang', { title: 'Tentang', activeNav: 'tentang' });
  } catch (error) {
    console.error('Error tentang:', error);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getTentangPage };