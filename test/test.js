'use strict';

require('co-mocha');
var should = require('should');
var orchestrator = require('..');

function isFunction(fn) {
  var getType = {};
  return fn && getType.toString.call(fn) === '[object Function]';
}

function fn1(arg) {
  return (arg + 100);
}

function fn2(arg) {
  return arg + 200;
}

function fn3(arg) {
  return arg + 300;
}

function fn4(arg1, arg2) {
  return arg1 + arg2 + 10;
}

function fnBreak() {
  return {
    breakChain: true,
    additionalMessage: 'some message'
  };
}

function first() {
  return 'first';
}

function second() {
  return 'second';
}

function third() {
  return 'third';
}

function * firstGen(arg) {
  return arg + 1;
}

function * secondGen(arg) {
  return arg + 10;
}

function * thirdGen(arg) {
  return (arg + 10);
}

function fnMultipleArgs1(arg1, arg2) {
  arg1 += 1;
  arg2 += 2;

  return arg1 + arg2;
}

function fnMultipleArgs2(sum) {
  sum += 3;

  return sum;
}

function fnArray(arg) {
  return [arg, arg];
}

function fnExpectArray(arg) {
  console.log(Array.isArray(arg));
  return arg;
}

describe('arch-orchestrator', function () {
  var fn;

  it('should be able to compose functions', function () {
    fn = orchestrator()
      .setNext(fn1)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    isFunction(fn).should.be.ok;
  });

  it('should receive array if array is passed as result', function () {
    fn = orchestrator()
      .setNext(fnArray)
      .setNext(fnExpectArray)
      .end();

    var res = fn(5);

    res[0].should.be.exactly(5);
    res[1].should.be.exactly(5);
    (Array.isArray(res)).should.be.ok;
  });

  it('should be able to use result from multiple functions', function () {
    fn = orchestrator()
      .setNext(fn1)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    var res = fn(0);
    res.should.be.exactly(600);
  });

  it('should be able to switch order of functions', function () {
    fn = orchestrator()
      .setNext(fn3)
      .setNext(fn1)
      .end();

    isFunction(fn).should.be.ok;
  });

  it('should be able to use result from different order then initial', function () {
    var res = fn(1000);
    res.should.be.exactly(1400);
  });

  it('should throw error if neither Function or GeneratorFunction is provided as setNext callback', function (done) {
    try {
      orchestrator()
        .setNext('should fail')
        .end();
    } catch (ex) {
      done();
    }
  });

  it('should throw error is end function is not called', function (done) {
    fn = orchestrator()
      .setNext(fn1)
      .setNext(fn2);

    try {
      fn(10);
    } catch (ex) {
      done();
    }
  });

  it('should call functions in defined order', function () {
    fn = orchestrator()
      .setNext(first)
      .setNext(second)
      .end();

    var res = fn();
    res.should.be.exactly('second');

    fn = orchestrator()
      .setNext(second)
      .setNext(first)
      .setNext(third)
      .end();

    res = fn();
    res.should.be.exactly('third');

    fn = orchestrator()
      .setNext(second)
      .setNext(first)
      .end();

    res = fn();
    res.should.be.exactly('first');
  });

  it('should be able to compose multiple generator functions', function * () {
    fn = orchestrator()
      .setNext(firstGen)
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    var res = yield fn(10);
    res.should.be.exactly(31);
    (res === 100).should.not.be.ok;
  });

  it('should be able to combine normal functions and generators', function * () {
    fn = orchestrator()
      .setNext(firstGen)
      .setNext(fn1)
      .setNext(secondGen)
      .setNext(fn2)
      .end();

    var res = yield fn(10);
    res.should.be.exactly(321);
    (res === 100).should.not.be.ok;
  });

  it('should be able to use chain parts with multiple arguments', function () {
    fn = orchestrator()
      .setNext(fnMultipleArgs1)
      .setNext(fnMultipleArgs2)
      .end();

    var res = fn(1, 1);

    res.should.be.exactly(8);
  });

  it('should be able to prepend arguments which are arguments of some other generator chain function', function () {
    fn = orchestrator()
      .setNext(fn1).argsTo(fn2)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    var res = fn(5);
    res.should.be.exactly(505);

    // see if calls are independent
    fn = orchestrator()
      .setNext(fn1).argsTo(fn2)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    res = fn(5);
    res.should.be.exactly(505);

    // see if chain still works for other cases
    fn = orchestrator()
      .setNext(fn1).argsTo(fn3)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    res = fn(5);
    res.should.be.exactly(305);

    // check if everything is cleaned
    should.not.exist(fn1.meta);
    should.not.exist(fn2.meta);
    should.not.exist(fn3.meta);
  });

  it('should be able to prepend arguments which are arguments of some other generator chain function calling argsTo multiple times', function () {
    fn = orchestrator()
      .setNext(fn1).argsTo(fn4)
      .setNext(fn2).argsTo(fn4)
      .setNext(fn3)
      .setNext(fn4)
      .end();

    var res = fn(5);
    res.should.be.exactly(120);
  });

  it('should be able to prepend arguments which are arguments of some other generator chain function', function * () {
    fn = orchestrator()
      .setNext(firstGen).argsTo(secondGen)
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    var res = yield fn(5);
    res.should.be.exactly(25);

    fn = orchestrator()
      .setNext(firstGen).argsTo(secondGen)
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    res = yield fn(5);
    res.should.be.exactly(25);

    fn = orchestrator()
      .setNext(firstGen).argsTo(thirdGen)
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    res = yield fn(5);
    res.should.be.exactly(15);

    should.not.exist(firstGen.meta);
    should.not.exist(secondGen.meta);
    should.not.exist(thirdGen.meta);
  });

  it('should be able to prepend arguments which are result of some function', function () {
    fn = orchestrator()
      .setNext(fn1).resultTo(fn3)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    var res = fn(10);
    res.should.be.exactly(410);
  });

  it('should be able to prepend arguments which are result of some function multiple times', function () {
    fn = orchestrator()
      .setNext(fn1).resultTo(fn4)
      .setNext(fn2)
      .setNext(fn3).resultTo(fn4)
      .setNext(fn4)
      .end();

    var res = fn(10);
    res.should.be.exactly(730);
  });

  it('should not cache results of previous calls', function () {
    fn = orchestrator()
      .setNext(fn1).resultTo(fn4)
      .setNext(fn2)
      .setNext(fn3).resultTo(fn4)
      .setNext(fn4)
      .end();

    var res = fn(10);
    res.should.be.exactly(730);

    res = fn(20);
    res.should.be.exactly(750);
  });

  it('should be able to prepend arguments which are result of some generator function', function * () {
    fn = orchestrator()
      .setNext(firstGen).resultTo(thirdGen)
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    var res = yield fn(10);

    should.not.exist(firstGen.meta);
    should.not.exist(secondGen.meta);
    should.not.exist(thirdGen.meta);
    res.should.be.exactly(21);
  });

  it('should be able to combine argsTo and resultTo calls', function () {
    fn = orchestrator()
      .setNext(fn1).argsTo(fn4)
      .setNext(fn2).resultTo(fn4)
      .setNext(fn3)
      .setNext(fn4)
      .end();

    var res = fn(5);
    res.should.be.exactly(320);
  });

  it('should be able to use current result as final for normal chain functions', function () {
    fn = orchestrator()
      .setNext(fn1).asResult()
      .setNext(fn2)
      .setNext(fn3)
      .end();

    var res = fn(100);
    res.should.be.exactly(200);

    fn = orchestrator()
      .setNext(fn1).asResult()
      .setNext(fn2)
      .setNext(fn3)
      .end();

    res = fn(200);
    res.should.be.exactly(300);

    should.not.exist(fn1.meta);
    should.not.exist(fn2.meta);
    should.not.exist(fn3.meta);
  });

  it('should be able to use current result as final for generator chain functions', function * () {
    fn = orchestrator()
      .setNext(firstGen).asResult()
      .setNext(secondGen)
      .setNext(thirdGen)
      .end();

    var res = yield fn(1);
    res.should.be.exactly(2);

    fn = orchestrator()
      .setNext(firstGen)
      .setNext(secondGen).asResult()
      .setNext(thirdGen)
      .end();

    res = yield fn(1);
    res.should.be.exactly(12);

    should.not.exist(firstGen.meta);
    should.not.exist(secondGen.meta);
    should.not.exist(thirdGen.meta);
  });

  it('should allow user to break chain', function() {
    fn = orchestrator()
      .setNext(fn1)
      .setNext(fnBreak)
      .setNext(fn2)
      .setNext(fn3)
      .end();

    var res = fn(1);
    res.breakChain.should.be.ok;
    res.additionalMessage.should.be.ok;
  });
});
