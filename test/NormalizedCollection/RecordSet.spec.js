'use strict';

var AbstractRecord      = require('../../src/NormalizedCollection/libs/AbstractRecord.js');
var RecordSet         = require('../../src/NormalizedCollection/libs/RecordSet.js');
var Record              = require('../../src/NormalizedCollection/libs/Record.js');
var NormalizedSnapshot  = require('../../src/NormalizedCollection/libs/NormalizedSnapshot');
var PathManager         = require('../../src/NormalizedCollection/libs/PathManager');
var FieldMap            = require('../../src/NormalizedCollection/libs/FieldMap');
var Path                = require('../../src/NormalizedCollection/libs/Path');
var Filter              = require('../../src/NormalizedCollection/libs/Filter');
var hp                  = require('./helpers');
var _                   = require('lodash');

describe('RecordSet', function() {
  describe('<constructor>', function() {
    it('should inherit from AbstractRecord', function() {
      var recs = new RecordSet(makeFieldMap(makePathMgr()), new Filter());
      expect(recs).toBeInstanceOf(AbstractRecord);
    });
  });

  describe('#child', function() {
    it('should return a Record', function() {
      var recs = new RecordSet(makeFieldMap(makePathMgr()), new Filter());
      var rec = recs.child('r1');
      expect(rec).toBeInstanceOf(Record);
    });

    it('should have child paths with the correct record id', function() {
      var recs = new RecordSet(makeFieldMap(makePathMgr()), new Filter());
      var rec = recs.child('recthingy');
      var paths = rec.getPathManager().getPaths();
      var count = 0;
      var keys = _.keys(PATHS);
      _.each(paths, function(p) {
        count++;
        expect(keys).toContain(p.name());
        if( p.name() === 'p4' ) {
          expect(p.url()).toBe(PATHS.p4.url);
        }
        else {
          expect(p.id()).toBe('recthingy');
        }
      });
      expect(count).toBe(keys.length);
    });

    it('should preserve the field map', function() {
      var recs = new RecordSet(makeFieldMap(makePathMgr()), new Filter());
      var rec = recs.child('r2');
      var parentMap = recs.getFieldMap();
      var map = rec.getFieldMap();
      expect(map.length).toBe(parentMap.length);
      rec.getFieldMap().forEach(function(f, k) {
        expect(parentMap.getField(k)).not.toBeNull();
      });
    });

    it('should return the same path (not a child) for dependent paths', function() {
      var recs = new RecordSet(makeFieldMap(makePathMgr()), new Filter());
      var rec = recs.child('recthingy');
      var paths = rec.getPathManager().getPaths();
      var found = 0;
      _.each(paths, function(p) {
        if( p.name() === 'p4' ) {
          found = true;
          expect(p.url()).toBe(PATHS.p4.url);
        }
      });
      expect(found).toBe(true);
    });
  });

  describe('#hasChild', function() {
    it('should return true if key exists in master snapshot', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      expect(recs.hasChild(snaps, 'r1')).toBe(true);
    });

    it('should return false if key does not exist in master snapshot', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      expect(recs.hasChild(snaps, 'r5')).toBe(false);
    });
  });

  describe('#getChildSnaps', function() {
    it('should return children of each non-dependent path with the given id', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var childSnaps = recs.getChildSnaps(snaps, 'r1');
      expect(childSnaps.length).toBe(snaps.length);
      var i = 0;
      _.each(RECS, function(expData, pathName) {
        if( pathName !== 'p4' ) { // skip the dependent path
          var snap = childSnaps[i];
          var pref = snaps[i].ref();
          var cref = snap.ref();
          expect(cref.toString()).toBe(hp.mergeUrl(pref.toString(), snap.key()));
        }
        i++;
      });
      expect(i).toBe(snaps.length);
    });

    it('should return the correct path for dependents', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var childSnaps = recs.getChildSnaps(snaps, 'r1');
      var found = false;
      expect(childSnaps.length).toBe(snaps.length);
      var i = 0;
      _.each(RECS, function(expData, pathName) {
        if( pathName === 'p4' ) { // skip the dynamic path
          found = true;
          var snap = childSnaps[i];
          expect(snap && snap.ref().toString()).toBe(PATHS.p4.url+'/'+RECS.p3.r1.p4key);
        }
        i++;
      });
      expect(found).toBe(true);
    });

    it('should return null for dependent path if dependency is null');

    it('should work with a complex dependency (c -> b -> a)');
  });

  describe('#mergeData', function() {
    it('should extend child records and not replace them', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, false);
      expect(data).toHaveKey('r1');
      expect(data.r1).toEqual({
        s1: 'p1r1', foo: 'p1r1foo',
        s2: 'p2r1', bar: 'p2r1bar',
        p3key: 'r1', p3val: { s: 'p3r1', b: 'p3r1baz', p4key: 'r41' },
        s3: 'p3r1', baz: 'p3r1baz',
        nest: {
          p4val: 'p4r41'
        }
      });
    });

    it('should include only records that exist in the first snapshot', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, false);
      expect(_.keys(data)).toEqual(_.keys(RECS.p1));
    });

    it('should include $key fields', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, false);
      expect(data.r1).toHaveKey('p3key');
      expect(data.r1.p3key).toBe('r1');
    });

    it('should include $value fields', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, false);
      expect(data.r1).toHaveKey('p3val');
      expect(data.r1 && data.r1.p3val).toEqual({s: 'p3r1', b: 'p3r1baz', p4key: 'r41'});
    });

    it('should observe nested aliases', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, false);
      expect(data.r1).toHaveKey('nest');
      expect(data.r1.nest).toHaveKey('p4val');
      expect(data && data.r1 && data.r1.nest).toEqual({
        p4val: 'p4r41'
      });
    });

    it('should include .priority of master path for isExport==true', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm, null, function(snap) {
        if( snap.key() === 'path1' ) { return 99; }
        else { return null; }
      });
      var data = recs.mergeData(snaps, true);
      expect(data).toHaveKey('.priority');
      expect(data['.priority']).toBe(99);
    });

    it('should include nested priorities for isExport==true', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm, null, function(snap) {
        if( snap.key() === 'r41' ) { return 99; }
        else { return null; }
      });
      var data = recs.mergeData(snaps, true);
      expect(data).toHaveKey('r1');
      expect(data && data.r1).toHaveKey('nest');
      expect(data && data.r1 && data.r1.nest).toHaveKey('p4val');
      expect(data && data.r1 && data.r1.nest && data.r1.nest.p4val).toHaveKey('.priority');
      expect(data && data.r1 && data.r1.nest && data.r1.nest.p4val).toEqual({
        '.value': 'p4r41', '.priority': 99
      });
    });

    it('should not include items filtered by where clause', function() {
      var fm = makeFieldMap(makePathMgr());
      var filter = new Filter();
      filter.add(function(data, name) {
        return name !== 'r2';
      });
      var recs = new RecordSet(fm, filter);
      var snaps = createSnaps(fm);
      var data = recs.mergeData(snaps, true);
      expect(data).toHaveKey('r1');
      expect(data).not.toHaveKey('r2');
    });
  });

  describe('#forEachKey', function() {
    it('should iterate record ids from first snapshot', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var keys = [];
      var spy = jasmine.createSpy('iterator').and.callFake(function(key, alias) {
        keys.push(alias);
        expect(RECS.p1).toHaveKey(alias);
      });
      recs.forEachKey(snaps, spy);
      expect(spy).toHaveCallCount(_.keys(RECS.p1).length);
    });

    it('should return the record id as the alias', function() {
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var spy = jasmine.createSpy('iterator').and.callFake(function(key, alias) {
        expect(key).toBe(alias);
      });
      recs.forEachKey(snaps, spy);
      expect(spy).toHaveBeenCalled();
    });

    it('should evaluate in the correct context', function() {
      var self = {};
      var fm = makeFieldMap(makePathMgr());
      var recs = new RecordSet(fm, new Filter());
      var snaps = createSnaps(fm);
      var spy = jasmine.createSpy('iterator').and.callFake(function(key, alias) {
        expect(this).toBe(self);
      });
      recs.forEachKey(snaps, spy, self);
      expect(spy).toHaveBeenCalled();
    });

    it('should not iterate filtered keys', function() {
      var fm = makeFieldMap(makePathMgr());
      var filter = new Filter();
      filter.add(function(data, name) {
        return name !== 'r2';
      });
      var recs = new RecordSet(fm, filter);
      var snaps = createSnaps(fm);
      var keys = _.map(RECS.p1, function(r, k) {
        if( k !== 'p2' ) { return k; }
      }).reverse();
      var spy = jasmine.createSpy('iterator').and.callFake(function(key, alias) {
        expect(key).toBe(keys.pop());
      });
      recs.forEachKey(snaps, spy);
      expect(keys.length).toBe(0);
    });
  });

  describe('saveData', function() { //todo-test
    it('calls set on the correct path for each field');

    it('puts children not in the map into the first path');

    it('deletes fields not in the set op');

    it('triggers callback after all paths have returned');

    it('returns an error if any path returns an error');

    it('removes all paths if given null');

    it('throws error if non-object passed with isUpdate === true');

    it('sets a primitive if there is exactly one path');

    it('throws an error if multiple paths are set to a primitive');

    it('observes priority and calls setPriority if one is provided');

    it('accepts .value');

    it('accepts .priority');
  });

  describe('#_start', function() {
    it('should invoke on() for master path');

    it('should not invoke on() for other paths');

    it('should not invoke on() twice (even for multiple events)');

    it('should invoke on() again if off() is called');
  });

  describe('#_stop', function() {
    it('should invoke off() for master path');

    it('should not call off() if on never called');
  });

  function makePathMgr() {
    return new PathManager(makePaths());
  }

  function makePaths() {
    var paths = [];
    _.each(PATHS, function(p) {
      var ref = hp.mockRef(p.url);
      var props = [ref, p.alias];
      if(p.dep) { props.push(p.dep); }
      paths.push(new Path(props));
    });
    return paths;
  }

  function makeFieldMap(mgr) {
    var map = new FieldMap(mgr);
    _.each(FIELDS, function(f) {
      map.add(makeFieldProps(f));
    });
    return map;
  }

  function makeFieldProps(f) {
    var parts = f.split(',');
    var props = {key: parts[0]+'.'+parts[1]};
    if( parts[2] ) {
      props.alias = parts[2];
    }
    return props;
  }

  function createSnaps(fieldMap, snapData, pri) {
    if( arguments.length === 2 ) { pri = null; }
    if( !snapData ) { snapData = _.cloneDeep(RECS); }
    var snaps = [];
    _.each(snapData, function(data, pathName) {
      var ref = fieldMap.getPath(pathName).ref();
      snaps.push(hp.stubSnap(ref, data, pri));
    });
    return snaps;
  }

  function loadDynamicData(p3data, p4data) {
    if( !p3data ) { return null; }
    var data = {};
    _.each(p3data, function(recData, recId) {
      if(_.has(recData, 'p4key') ) {
        data[recId] = p4data[recData.p4key];
      }
    });
    return data;
  }

  var RECS = {
    p1: {
      r1: { s: 'p1r1', f: 'p1r1foo' },
      r2: { s: 'p1r2', b: false, n: 0 },
      r4: { s: 'p1r4', f: 'p1r4foo', b: 'p1r4bar' }
    },
    p2: {
      r1: { s: 'p2r1', b: 'p2r1bar' },
      r3: { s: 'p2r3', o: {foo: 'bar'} },
      r4: { s: 'p2r4', f: 'p2r4foo', b: 'p2r4bar', p4key: 'r42' }
    },
    p3: {
      r1: { s: 'p3r1', b: 'p3r1baz',  p4key: 'r41' },
      r2: { s: 'p3r2', p4key: 'r42', b: true, n: 1 },
      r4: { s: 'p3r4', f: 'p3r4foo', b: 'p3r4bar' },
      r5: { s: 'p3r5', p4key: 'r43' }
    },
    p4: {
      r41: 'p4r41',
      r42: 'p4r42',
      r43: 'p4r43'
    }
  };

  var PATHS = {
    p1: {id: 'path1', alias: 'p1', url: 'Mock1://path1'},
    p2: {id: 'path2', alias: 'p2', url: 'Mock1://p2parent/path2'},
    p3: {id: null,    alias: 'p3', url: 'Mock2://'},
    p4: {id: 'path4', alias: 'p4', url: 'Mock1://path4', dep: 'p3.p4key'}
  };

  var FIELDS = [
    'p1,s,s1', 'p1,f,foo', 'p1,f99',
    'p2,s,s2', 'p2,n', 'p2,b,bar',
    'p3,$key,p3key', 'p3,$value,p3val', 'p3,s,s3', 'p3,b,baz',
    'p4,$value,nest.p4val'
  ];
});
