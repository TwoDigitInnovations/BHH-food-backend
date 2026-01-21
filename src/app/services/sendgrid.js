const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const sendMailWithSubjectViaSendgrid = async (to, subject, html) => {
    console.log(to, subject, html)
    const msg = {
        // to,
        from: {
            name: 'Bach Hoa Houston',
            email: process.env.FROM_EMAIL
        }, // Use the email address or domain you verified above
        subject,
        // text: html,
        html,
        personalizations: to.map((email) => ({
            to: email,
        })),

    };
    try {
        await sgMail.send(msg);
        console.log("✅ SendGrid email sent successfully");
    } catch (error) {
        console.error("❌ SendGrid Error:", error.message);

        if (error.response) {
            console.error("SendGrid Response Error:", error.response.body)
        }
        
        // Re-throw error so fallback can catch it
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
        }, // Use the email address or domain you verified above // Use the email address or domain you verified above
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