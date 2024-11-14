const UserRepository = require('../repositories/user.repository');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  
}

module.exports = UserService;
