'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker'); //library that helps with generating random seedData
const mongoose = require('mongoose'); //library to help with db interaction (knex)

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

// generate an object represnting a blog.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    title: faker.random.words(),
    content: faker.lorem.sentence()
  };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('BlogPosts API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedBlogData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    console.log('API resource before ran');
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    console.log('API resource beforeEach ran');
    return seedBlogData();
  });

  afterEach(function() {
    console.log('API resource afterEach ran');
    return tearDownDb();
  });

  after(function() {
    console.log('API resource after ran');
    return closeServer();
  });

  describe('GET endpoint', function() {

    it('should return all existing blog posts', function() {
    //  console.log('test false ran');
    // expect(false).be.false;
    // strategy:
    //    1. get back all blogposts returned by GET request to `/posts`
    //    2. prove res has right status, data type
    //    3. prove the number of blogposts we got back is equal to number
    //       in db.
    //
    // need to have access to mutate and access `res` across
    // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
        // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          // otherwise our db seeding didn't work
          console.log('what is body', res.body.length);
          expect(res.body).to.have.length.of.at.least(1); 
          return BlogPost.count();
        })
        .then(function(count) {
          console.log(count);
          expect(res.body).to.have.lengthOf(count);
        });
    });


    it('should return blogposts with right fields', function() {
      // Strategy: Get back all blog posts, and ensure they have expected keys
      //console.log('test true ran');
      //expect(true).be.true;
      let resBlog;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length.of.at.least(1);

          res.body.forEach(function(blogpost) {
            expect(blogpost).to.be.a('object');
            expect(blogpost).to.include.keys(
              'id', 'author', 'title', 'content','created');
          });
          resBlog = res.body[0];
          return BlogPost.findById(resBlog.id);
        })
        .then(function(blogpost) {
          expect(resBlog.id).to.equal(blogpost.id);
          expect(resBlog.author).to.contain(blogpost.author.firstName);
          expect(resBlog.title).to.equal(blogpost.title);
          expect(resBlog.content).to.equal(blogpost.content); 
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the blogpost we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blogpost', function() {

      const newBlogPost = generateBlogData();

      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          console.log(res.body);
          expect(res.body).to.include.keys(
            'id', 'author', 'title', 'content','created');
          expect(res.body.author).to.contain(newBlogPost.author.firstName);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.title).to.equal(newBlogPost.title);
          expect(res.body.content).to.equal(newBlogPost.content);
          return BlogPost.findById(res.body.id);
        })
        .then(function(restaurant) {
          expect(restaurant.author.firstName).to.equal(newBlogPost.author.firstName);
          expect(restaurant.author.lastName).to.equal(newBlogPost.author.lastName);
          expect(restaurant.title).to.equal(newBlogPost.title);
          expect(restaurant.content).to.equal(newBlogPost.content);
        });
    });
  });

});
