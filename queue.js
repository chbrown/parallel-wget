'use strict'; /*jslint node: true, es5: true, indent: 2 */ /*globals setImmediate */
var util = require('util');
var events = require('events');

/** Queue: like async.queue but with events (server-side only).

Start a queue that will run a maximum of two tasks at a time
and initialize with the task, a, b, d, and e

    new Queue(2, ['a', 'b', 'd', 'e']);

Add tasks after the queue has been created:

    queue.add(list_of_tasks)

The queue will not run until a 'start' listener has been added.

  events emitted:
    .on('start', function(task, callback) {
      // callback signature: function(err)
      setTimeout(function() {
        console.log('Waited', task);
        callback();
      }, 100);
    })
    .on('finish', function(err, task) {
      // somewhat redundant, since start gives a callback
    })
    .on('drain', function() {
      console.log('Totally done!');
      process.exit(0);
    })

*/
var Queue = module.exports = function(concurrency, tasks) {
  // inherit EventEmitter traits
  events.EventEmitter.call(this);

  // set up private variables
  this._queue = [];
  this._concurrency = concurrency; // number of maximum tasks to have running at one point
  this._active = false; // whether someone is listening and we should be processing tasks
  this._in_progress = 0; // number of tasks currently out for processing

  // publically accessible counts
  this.remaining = 0;
  this.completed = 0;

  // init with given arguments
  if (tasks !== undefined) {
    this.push(tasks);
  }

  var self = this;
  this.on('newListener', function(event, fn) {
    if (event == 'start') {
      self._active = true;
      self._tick(); // bump!
    }
  });
};
util.inherits(Queue, events.EventEmitter);

// public methods
Queue.prototype.push = function(tasks) {
  if (Array.isArray(tasks)) {
    // handle either a list of tasks
    Array.prototype.push.apply(this._queue, tasks);
  }
  else {
    // or just one if only one is supplied.
    this._queue.push(tasks);
  }
  this._tick();
  return this;
};
Queue.prototype.saturated = function() {
  // returns a boolean: "saturated" which is true if the number of tasks queued exceeds the allotted concurrency
  return this.remaining > this._concurrency;
};
Queue.prototype.setConcurrency = function(concurrency) {
  this._concurrency = concurrency;
  this._tick();
};

// private methods
Queue.prototype._shift = function() {
  var self = this;
  // we pull from the front of the queue
  var task = this._queue.shift();
  this._in_progress++;
  setImmediate(function() {
    self.emit('start', task, function(err) { // may have other arguments
      self._in_progress--;
      self.remaining = self._queue.length + self._in_progress;
      self.completed++;
      self.emit('finish', err, task);
      // if that was the last task, emit drain
      if (self.remaining === 0) {
        self.emit('drain');
      }
      self._tick(); // can't hurt...
    });
    self._tick(); // we need to fill up the in-progress queue
  });
};
Queue.prototype._tick = function() {
  // console.error('Queue._tick', this._active, this._queue.length, this._in_progress, this._concurrency);
  // this method doesn't actually do anything, just decides if we should process the next task
  // only do anything if someone is listening (_active is true)
  if (this._active) {
    // if there are no more tasks, do nothing
    if (this._queue.length) {
      // we only start a new task if we have concurrency to do so
      if (this._in_progress < this._concurrency) {
        // start it up and increment the count of tasks off being processed
        this._shift();
      }
    }
  }
};
