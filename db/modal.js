// const { Sequelize, DataTypes, Op } = require('sequelize');
import { Sequelize, DataTypes , Op} from 'sequelize';

export const sequelize = new Sequelize('bitespeedDB', 'postgres', '1234', {
  host: 'localhost',
  dialect: 'postgres'
});

export const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkedId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Contacts',
      key: 'id'
    }
  },
  linkPrecedence: {
    type: DataTypes.ENUM('primary', 'secondary'),
    allowNull: false,
    defaultValue: 'primary'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    onUpdate: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true
});

