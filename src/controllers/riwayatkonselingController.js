const getRiwayatKonseling = (req, res) => {
  try {
    res.render('riwayatkonseling', {
      title: 'Konsultasi Berhasil',
      activeNav: 'konseling',
    });
  } catch (err) {
    console.error('Error riwayat konseling:', err);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getRiwayatKonseling };