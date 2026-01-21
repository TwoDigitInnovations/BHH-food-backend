const localStratagy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const { hashValue } = require('../../src/middlewares/codeDecript');
const User = mongoose.model('User');
module.exports = new localStratagy({
    usernameField: 'username',
    passwordField: 'password',
},
    async (username, password, callback) => {
        try {
            const hash = hashValue(username);
            console.log('hash key==>', hash)
            let user = await User.findOne({ user_email_hash: hash });
            if (user) {
                if (!user.isValidPassword(password)) {
                    return callback(null, false, { "message": "Password is Incorrect." });
                }
            } else {
                return callback(null, false, { "message": "User does not exist." });
            }
            return callback(null, user, { "message": "Successfully LoggedIn." });
        }
        catch (error) {
            return callback(error, false, { "message": "Something Went Wrong." });
        }
    }
);
