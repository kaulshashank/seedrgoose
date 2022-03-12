import { model, seed, documents } from "../src";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Mongoose } from "mongoose";
import { expect } from "chai";

describe("documents()", function () {
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
        }
    });
    const WizardModel = mongoose.model("wizards", WizardSchema);

    const WandSchema = new mongoose.Schema({
        wood: {
            type: String,
            default: "oak"
        }
    });
    const WandModel = mongoose.model("wands", WandSchema);

    const wizard = model(WizardModel);
    const wand = model(WandModel);

    afterEach("Delete wizard", async function () {
        await Promise.all([WizardModel.deleteMany({}), WandModel.deleteMany({})]);
    });

    it("Check tree", async function () {

        const tree = documents(await seed(
            wizard(
                wand()
            )
        ));

        expect(tree).to.have.property("collection").to.eq("wizards");
        expect(tree).to.have.property("children").to.be.an("array").with.lengthOf(1);
        expect(tree.children[0]).to.have.property("collection").to.eq("wands");

        const wizards = await WizardModel.find({});
        const wands = await WandModel.find({});

        expect(wizards[0]).to.exist;
        expect(wands[0]).to.exist;

        const wiz = wizards[0];
        const wan = wands[0];
        const comparisonWiz: any = tree.document;
        const comparisonWan: any = tree.children[0].document;

        expect(wiz).to.have.property("firstName").to.eq(comparisonWiz.firstName);
        expect(wiz).to.have.property("lastName").to.eq(comparisonWiz.lastName);
        expect(wiz).to.have.property("age").to.eq(comparisonWiz.age);
        expect(wan).to.have.property("wood").to.eq(comparisonWan.wood);
    });

    after("Disconnect", async function () {
        mms.stop();
    });

});