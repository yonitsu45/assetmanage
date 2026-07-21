const User = require('../models/user');

const profileController = {
  async update(req, res) {
    try {
      const userId = req.session.userId;
      const { username, full_name } = req.body;
      const data = {};

      if (username !== undefined && username !== '') {
        const existing = await User.findByUsername(username);
        if (existing && existing.id !== userId) {
          return res.redirect('/?profile_error=username_taken');
        }
        data.username = username;
      }

      if (full_name !== undefined) {
        data.full_name = full_name;
      }

      if (req.file) {
        data.profile_picture = 'uploads/profiles/' + req.file.filename;
      }

      if (Object.keys(data).length > 0) {
        await User.update(userId, data);
      }

      if (data.username) req.session.username = data.username;
      if (data.full_name) req.session.fullName = data.full_name || data.username;
      if (data.profile_picture) req.session.profilePicture = data.profile_picture;

      res.redirect('/?profile_success=updated');
    } catch (err) {
      console.error('Profile update error:', err);
      res.redirect('/?profile_error=update_failed');
    }
  }
};

module.exports = profileController;
