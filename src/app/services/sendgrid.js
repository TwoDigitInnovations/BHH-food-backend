const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const sendMailWithSubjectViaSendgrid = async (to, subject, html) => {
    const msg = {
        from: {
            name: 'Bach Hoa Houston',
            email: process.env.FROM_EMAIL
        },
        subject,
        html,
        personalizations: to.map((email) => ({
            to: email,
        })),
    };
    
    try {
        await sgMail.send(msg);
        console.log("SendGrid email sent successfully");
    } catch (error) {
        console.error("SendGrid Error:", error.message);
        if (error.response) {
            console.error("SendGrid Response Error:", error.response.body)
        }
        throw error;
    }
}

const sendMailWithSTemplateViaSendgrid = async (to, templateId, subject, data = { Name: 'Bach Hoa Houston' }) => {
    // console.log(to, templateId, subject)
    const msg = {
        personalizations: to.map((email) => ({
            to: email,
        })),
        from: {
            name: 'Bach Hoa Houston',
            email: process.env.FROM_EMAIL
        }, 
        templateId,
        // subject,
        dynamicTemplateData: {
            subject
        }
    };
    // console.log(msg)
    try {
        await sgMail.send(msg);
    } catch (error) {
        console.error(error);

        if (error.response) {
            console.error(error.response.body)
        }
    }
}

module.exports = { sendMailWithSubjectViaSendgrid, sendMailWithSTemplateViaSendgrid }