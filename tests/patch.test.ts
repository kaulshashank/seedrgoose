import { model, seed, patch } from "../src";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Mongoose } from "mongoose";
import { expect } from "chai";

describe("patch()", function () {
    let mms: MongoMemoryServer;

    const mongoose = new Mongoose();

    before("Connect", async function () {
        mms = await MongoMemoryServer.create();

        await mongoose.connect(mms.getUri());
    })

    const WizardSchema = new mongoose.Schema({
        firstName: {
            type: String,
            default: "John"
        },
        lastName: {
            type: String,
            default: "Doe"
        },
        age: {
            type: Number,
            default: 50
        },
        stats: {
            hp: {
                type: Number,
                default: 100
            },
            magic: {
                type: Number,
                default: 3
            }
        },
        beasts: [{
            name: String,
            power: {
                type: Number,
                default: 5
            }
        }]
    });
    const WizardModel = mongoose.model("people", WizardSchema);

    const wizard = model(WizardModel);

    afterEach("Delete wizard", async function() {
        await WizardModel.deleteMany({});
    });

    it("Patch fields", async function () {

        await seed(
            patch(
                wizard(),
                {
                    firstName: "Merlin",
                    lastName: "The Wizard",
                    'stats.hp': 50,
                    'beasts.0.name': "Elvarg",
                    'beasts.1.power': 5
                }
            )
        );

        const wizards = await WizardModel.find({});

        expect(wizards[0]).to.exist;
        
        const wiz = wizards[0];

        expect(wiz).to.have.property("firstName").to.eq("Merlin");
        expect(wiz).to.have.property("lastName").to.eq("The Wizard");
        expect(wiz).to.have.property("age").to.eq(50);
        expect(wiz).to.have.property("stats").to.have.property("hp").to.eq(50);
        expect(wiz).to.have.property("stats").to.have.property("magic").to.eq(3);
        expect(wiz).to.have.property("beasts").to.have.lengthOf(2);
        expect(wiz.beasts[0]).to.have.property("name").to.eq("Elvarg");
        expect(wiz.beasts[1]).to.have.property("power").to.eq(5);

    });

    after("Disconnect", async function () {
        mms.stop();
    });

});