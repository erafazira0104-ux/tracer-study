const getBerandaPage = (req, res) => {
  try {
    const statistik = {
      totalAlumni: 1248,
      alumniBekerja: 973,
      alumniWirausaha: 150,
      melanjutkanStudi: 125,
    };
    res.render('beranda', { title: 'Beranda', activeNav: 'beranda', statistik });
  } catch (error) {
    console.error('Error beranda:', error);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getBerandaPage };