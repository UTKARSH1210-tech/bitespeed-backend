import express from "express"
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
import {sequelize, Contact} from "./db/modal.js"
import { Op } from "sequelize";
import { LinkPrecedenceTypes } from "./linkPrecedence.js";


const PORT = process.env.PORT || 5000;

dotenv.config();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));





function getUniqueEmails(records) {
    const emails = new Set(records.map(record => record.email).filter(Boolean));
    return Array.from(emails);
  }
  
  function getUniquePhoneNumbers(records) {
    const phoneNumbers = new Set(records.map(record => record.phoneNumber).filter(Boolean));
    return Array.from(phoneNumbers);
  }
  
  async function fetchRelatedContacts(contactId) {
    const ids = new Set([contactId]);
    let previousSize = 0;
  
    while (previousSize < ids.size) {
      previousSize = ids.size;
      const records = await Contact.findAll({
        where: {
          [Op.or]: [
            { id: Array.from(ids) },
            { linkedId: Array.from(ids) }
          ]
        }
      });
  
      records.forEach(record => {
        ids.add(record.id);
        if (record.linkedId) {
          ids.add(record.linkedId);
        }
      });
    }
  
    return Contact.findAll({
      where: {
        id: Array.from(ids)
      }
    });
  }
  
  async function generateResponse(email, phoneNumber) {
    const initialContacts = await Contact.findAll({
      where: {
        [Op.or]: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }
    });
  
    if (initialContacts.length === 0) {
      return null;
    }
  
    const primaryContact = initialContacts.find(contact => contact.linkPrecedence === LinkPrecedenceTypes.PRIMARY) || initialContacts[0];
    const relatedContacts = await fetchRelatedContacts(primaryContact.id);
  
    return {
      contact: {
        primaryContactId: primaryContact.id,
        emails: getUniqueEmails(relatedContacts),
        phoneNumbers: getUniquePhoneNumbers(relatedContacts),
        secondaryContactIds: relatedContacts.filter(contact => contact.id !== primaryContact.id).map(contact => contact.id)
      }
    };
  }
  









  app.post('/contacts', async (req, res) => {
    const {email , phoneNumber} = req.body;
  
    try {
        let records = await Contact.findAll({
            where: {
                [Op.or]: [{ email: email }, { phoneNumber: phoneNumber }]
            }
        });
        // console.log(records[0])
        if (records.length == 0){
            const newContact = await Contact.create({email: email, phoneNumber : phoneNumber });
            return res.status(201).json(newContact);
        }
        else{
            const newContact = await Contact.create({email: email, phoneNumber : phoneNumber , linkedId : records[0].id , linkPrecedence : "secondary"});
            return res.status(201).json(newContact);
        }
        
    } catch (error) {
        console.error('Error adding contact:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Endpoint to view all contacts
  app.get('/contacts', async (req, res) => {
    try {
      const contacts = await Contact.findAll();
      return res.status(200).json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });


app.post('/identify', async (req, res) => {
    try {
      const { email, phoneNumber } = req.body;

      const primaryEmailprecendence = await Contact.findAll({
        where: {
          email: email,
          linkPrecedence: LinkPrecedenceTypes.PRIMARY
        }
      });

      const primaryPhoneNumberprecendence = await Contact.findAll({
        where: {
          phoneNumber : phoneNumber,
          linkPrecedence: LinkPrecedenceTypes.PRIMARY
        }
      });
    
      console.log("P-email" , primaryEmailprecendence)
      console.log("P-phoneNumber" , primaryPhoneNumberprecendence)
      if (primaryEmailprecendence.length !== 0 && primaryPhoneNumberprecendence.length !== 0){
        
        const primaryEmailContact = primaryEmailprecendence[0];
        const primaryPhoneContact = primaryPhoneNumberprecendence[0];
        
        // Convert the primary phone contact to secondary and link it to the primary email contact
        await Contact.update(
            {
                linkPrecedence: LinkPrecedenceTypes.SECONDARY,
                linkedId: primaryEmailContact.id
            },
            {
                where: {
                    id: primaryPhoneContact.id
                }
            }
        );
        
        // Generate the response with updated contact information
        const response = await generateResponse(email, phoneNumber);
        return res.json(response);

      }


      const primaryContacts = await Contact.findAll({
        where: {
          [Op.or]: [
            { email: email },
            { phoneNumber: phoneNumber }
          ]
        }
      });
  
      if (primaryContacts.length) {
        const response = await generateResponse(email, phoneNumber);
        return res.json(response);
      }
  
      const partialRecord = await Contact.findAll({
        where: {
          [Op.or]: [{ email }, { phoneNumber }]
        }
      });
  
      if (!partialRecord.length) {
        const newContact = await Contact.create({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedenceTypes.PRIMARY
        });
        const response = await generateResponse(email, phoneNumber);
        return res.json(response);
      }
  
      const records = partialRecord.map(record => ({
        id: record.id,
        phoneNumber: record.phoneNumber,
        email: record.email,
        linkedId: record.linkedId,
        linkPrecedence: record.linkPrecedence
      }));
  
      let isEmailFound = records.some(record => record.email === email);
      let isPhoneFound = records.some(record => record.phoneNumber === phoneNumber);
  
      const linkId = records[0].id;
  
      for (const record of records.slice(1)) {
        if (record.linkPrecedence !== LinkPrecedenceTypes.SECONDARY) {
          await Contact.update(
            {
              linkedId: linkId,
              linkPrecedence: LinkPrecedenceTypes.SECONDARY
            },
            { where: { id: record.id } }
          );
        }
        isEmailFound ||= record.email === email;
        isPhoneFound ||= record.phoneNumber === phoneNumber;
      }
  
      if (!isEmailFound || !isPhoneFound) {
        await Contact.create({
          email,
          phoneNumber,
          linkedId: linkId,
          linkPrecedence: LinkPrecedenceTypes.SECONDARY
        });
      }
  
      const response = await generateResponse(email, phoneNumber);
      res.json(response);
    } catch (error) {
      console.error('Error identifying contact:', error);
      res.status(500).send('Internal Server Error');
    }
  });




app.use("/", (req, res) => {
    return res.send("Bitespeed Backend App");
});

app.listen(PORT, async () => {
    await sequelize.sync();
    console.log(`Listening to port ${PORT}`);
});


