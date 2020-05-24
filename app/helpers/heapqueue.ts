// @ts-nocheck
/*
  This implementation is very loosely based off js-priority-queue
  by Adam Hooper from https://github.com/adamhooper/js-priority-queue

  The js-priority-queue implementation seemed a teensy bit bloated
  with its require.js dependency and multiple storage strategies
  when all but one were strongly discouraged. So here is a kind of
  condensed version of the functionality with only the features that
  I particularly needed.
  Using it is pretty simple, you just create an instance of HeapQueue
  while optionally specifying a comparator as the argument:
  var heapq = new HeapQueue()
  var customq = new HeapQueue(function(a, b){
  	// if b > a, return negative
  	// means that it spits out the smallest item first
	return a - b
  })
  Note that in this case, the default comparator is identical to
  the comparator which is used explicitly in the second queue.
  Once you've initialized the heapqueue, you can plop some new
  elements into the queue with the push method (vaguely reminiscent
  of typical javascript arays)
  heapq.push(42);
  heapq.push("kitten");
  The push method returns the new number of elements of the queue.
  You can push anything you'd like onto the queue, so long as your
  comparator function is capable of handling it. The default
  comparator is really stupid so it won't be able to handle anything
  other than an number by default.
  You can preview the smallest item by using peek.
  heapq.push(-9999)
  heapq.peek() ==> -9999
  The useful complement to to the push method is the pop method,
  which returns the smallest item and then removes it from the
  queue.
  heapq.push(1)
  heapq.push(2)
  heapq.push(3)
  heapq.pop() ==> 1
  heapq.pop() ==> 2
  heapq.pop() ==> 3
*/
export default function HeapQueue(cmp){
	this.cmp = (cmp || function(a, b){ return a - b });
	this.length = 0;
	this.data = []
}
HeapQueue.prototype.peek = function(){
	return this.data[0]
}
HeapQueue.prototype.push = function(value){
	this.data.push(value);
	var pos = this.data.length - 1,
		parent, x;
	while(pos > 0){
		parent = (pos - 1) >>> 1;
		if(this.cmp(this.data[pos], this.data[parent]) < 0){
			x = this.data[parent]
			this.data[parent] = this.data[pos];
			this.data[pos] = x;
			pos = parent;
		}else break;
	}
	return ++this.length;
}
HeapQueue.prototype.pop = function(){
	var ret = this.data[0],
		last_val = this.data.pop();
	this.length--;
	if(this.data.length > 0){
		this.data[0] = last_val;
		var pos = 0,
			last = this.data.length - 1,
      left, right, minIndex, x;
    // eslint-disable-next-line
		while(1){
			left = (pos << 1) + 1;
			right = left + 1;
			minIndex = pos;
			if(left <= last && this.cmp(this.data[left], this.data[minIndex]) < 0) minIndex = left;
			if(right <= last && this.cmp(this.data[right], this.data[minIndex]) < 0) minIndex = right;
			if(minIndex !== pos){
				x = this.data[minIndex]
				this.data[minIndex] = this.data[pos]
				this.data[pos] = x;
				pos = minIndex
			}else break;
		}
	}
	return ret
}
