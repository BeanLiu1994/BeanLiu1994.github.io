#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <set>
#include <list>
#include <vld.h>
using namespace std;
class Message;

class Folder
{
	set<const Message*> fd;
public:
	void addMsg(const Message* msg)
	{
		fd.insert(msg);
	}
	void remMsg(const Message* msg)
	{
		fd.erase(msg);
	}

};

class Message
{
	friend class Folder;
	friend void swap(Message& lhs, Message& rhs);
public:
	explicit Message(const string& str=""):
		contents(str){}
	Message(const Message& rhs)
		:contents(rhs.contents), folders(rhs.folders)
	{
		add_to_Folders(rhs);
	}
	Message& operator=(const Message& rhs)
	{
		remove_from_Folders();
		contents = rhs.contents;
		folders = rhs.folders;
		add_to_Folders(rhs);
		return *this;
	}
	~Message()
	{
		remove_from_Folders();
	}

	void save(Folder& fd)
	{
		folders.insert(&fd);
		fd.addMsg(this);
	}
	void remove(Folder& fd)
	{
		folders.erase(&fd);
		fd.remMsg(this);
	}
private:
	string contents;
	set<Folder*> folders;
	
	void add_to_Folders(const Message& m)
	{
		for (auto f : m.folders)//?
			f->addMsg(this);
	}
	void remove_from_Folders()
	{
		for (auto f : folders)
			f->remMsg(this);
	}
};

void swap(Message& lhs, Message& rhs)
{
	using std::swap;
	lhs.remove_from_Folders();
	rhs.remove_from_Folders();
	swap(lhs.contents, rhs.contents);
	swap(lhs.folders, rhs.folders);
	lhs.add_to_Folders(lhs);
	rhs.add_to_Folders(rhs);
}

int main()
{
	vector<Folder> MyFolder(3);
	Message t1("test1");
	Message t2("test2");
	Message t3("test3");
	Message t4("test4");
	t1.save(MyFolder[0]);
	t1.save(MyFolder[1]);
	t2.save(MyFolder[1]);
	t3.save(MyFolder[2]);
	Message t_temp = t1;

	return 0;
}